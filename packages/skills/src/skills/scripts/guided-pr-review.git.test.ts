import { expect, test } from "bun:test";
import { build, embedded, fixture } from "./guidedFixture.js";

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
