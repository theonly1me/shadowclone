import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { build, embedded, fixture } from "./guidedFixture.js";

function git(options: { directory: string; arguments: string[] }) {
  const result = Bun.spawnSync(["git", "-C", options.directory, ...options.arguments], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

test("a connected three-PR guide retains every diff and attributes PR 1 and PR 3 in their combined file", async () => {
  const context = await fixture();
  expect(build(context)).toMatchObject({
    exitCode: 0,
    output: expect.stringContaining("5/5 changed files"),
  });
  const html = await Bun.file(context.outputPath).text();
  expect(embedded(html)).toMatchObject({
    pulls: [
      { id: "pr-1", files: [{ path: "job.ts", additions: 1, deletions: 1 }] },
      {
        id: "pr-2",
        files: [
          { path: "README.md", baseMarkdown: "# Before\nOne attempt.\n" },
          { path: "blob.bin", patch: expect.stringContaining("Binary files") },
          { path: 'quoted "name".txt', oldPath: "old name.txt", status: "R100" },
        ],
      },
      { id: "pr-3", files: [{ path: "job.ts", additions: 1, deletions: 1 }] },
    ],
    combined: {
      baseSha: context.base,
      headSha: context.third,
      files: expect.arrayContaining([
        expect.objectContaining({
          path: "job.ts",
          rows: expect.arrayContaining([
            expect.objectContaining({
              kind: "add",
              text: "export const attempts = 3;",
              owner: "pr-1",
            }),
            expect.objectContaining({
              kind: "add",
              text: "export const notify = true;",
              owner: "pr-3",
            }),
          ]),
        }),
      ]),
    },
  });
  expect(html).not.toContain(context.directory);
});

test("literal route filenames keep each diff separate from matching glob paths", async () => {
  const context = await fixture();
  const paths = ["app/[id]/page.tsx", "app/i/page.tsx", "literal*.txt", "literal-more.txt"];
  for (const file of paths) {
    await mkdir(path.dirname(path.join(context.directory, file)), { recursive: true });
    await writeFile(path.join(context.directory, file), "Content for " + file + "\n");
  }
  git({ directory: context.directory, arguments: ["--literal-pathspecs", "add", "--", ...paths] });
  git({
    directory: context.directory,
    arguments: ["-c", "commit.gpgsign=false", "commit", "-m", "routes"],
  });
  const headSha = git({ directory: context.directory, arguments: ["rev-parse", "HEAD"] });
  const [pull] = context.input.pulls;
  const [group] = context.input.groups;
  if (!pull || !group) throw new Error("The fixture needs a PR and a group.");
  await writeFile(
    pull.reviewFile,
    JSON.stringify({
      pull: { repository: pull.repository, baseSha: context.third, headSha },
      findings: [],
      skippedPaths: [],
    }),
  );
  await writeFile(
    context.inputPath,
    JSON.stringify({
      ...context.input,
      evidence: [],
      pulls: [{ ...pull, baseSha: context.third, headSha }],
      groups: [
        {
          ...group,
          prs: [pull.id],
          files: paths.map((file) => ({ pr: pull.id, path: file })),
          steps: [],
        },
      ],
    }),
  );
  expect(build(context)).toMatchObject({ exitCode: 0, error: "" });
  expect(embedded(await Bun.file(context.outputPath).text())).toMatchObject({
    pulls: [
      {
        files: expect.arrayContaining(
          paths.map((file) =>
            expect.objectContaining({
              path: file,
              additions: 1,
              rows: expect.arrayContaining([
                expect.objectContaining({ text: "Content for " + file }),
              ]),
            }),
          ),
        ),
      },
    ],
  });
});

test("forced Git diff colors preserve selectable rows and honest change counts", async () => {
  const context = await fixture();
  git({ directory: context.directory, arguments: ["config", "color.diff", "always"] });
  git({ directory: context.directory, arguments: ["config", "color.ui", "always"] });
  expect(build(context).exitCode).toBe(0);
  const html = await Bun.file(context.outputPath).text();
  expect(embedded(html)).toMatchObject({
    pulls: [
      {
        files: [
          {
            path: "job.ts",
            additions: 1,
            deletions: 1,
            rows: expect.arrayContaining([
              expect.objectContaining({ text: "export const attempts = 3;", newLine: 1 }),
            ]),
          },
        ],
      },
      {},
      {},
    ],
  });
  expect(html).not.toContain("\\u001b[");
});
