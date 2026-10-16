import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { seedSkillsDirectory } from "@shadowclone/core";

export const skillDirectory = path.join(await seedSkillsDirectory(), "guided-pr-review");

export function command(options: {
  readonly script: string;
  readonly arguments: readonly string[];
}) {
  const result = Bun.spawnSync(
    [process.execPath, path.join(skillDirectory, options.script), ...options.arguments],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString(),
    error: result.stderr.toString(),
  };
}

export async function fixture() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "guided-review-")));
  function git(arguments_: readonly string[]) {
    const result = Bun.spawnSync(["git", "-C", directory, ...arguments_], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    return result.stdout.toString().trim();
  }
  async function commit(message: string) {
    git(["add", "."]);
    git(["-c", "commit.gpgsign=false", "commit", "-m", message]);
    return git(["rev-parse", "HEAD"]);
  }
  git(["init", "-q"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["config", "user.name", "Fixture"]);
  await writeFile(
    path.join(directory, "job.ts"),
    "export const attempts = 1;\nexport const notify = false;\n",
  );
  await writeFile(path.join(directory, "README.md"), "# Before\nOne attempt.\n");
  await writeFile(path.join(directory, "old name.txt"), "unchanged renamed content\n");
  await writeFile(path.join(directory, "blob.bin"), new Uint8Array([0, 1, 2]));
  const base = await commit("base");
  await writeFile(
    path.join(directory, "job.ts"),
    "export const attempts = 3;\nexport const notify = false;\n",
  );
  const first = await commit("retry");
  git(["mv", "old name.txt", 'quoted "name".txt']);
  await writeFile(
    path.join(directory, "README.md"),
    "# After\n**Three** attempts.\n- Keep `state`.\n<script>unsafe()</script>\n",
  );
  await writeFile(path.join(directory, "blob.bin"), new Uint8Array([0, 3, 4]));
  const second = await commit("support");
  await writeFile(
    path.join(directory, "job.ts"),
    "export const attempts = 3;\nexport const notify = true;\n",
  );
  const third = await commit("notify");
  const revisions = [
    { base, head: first, role: "Retries a failed job up to three times." },
    { base: first, head: second, role: "Documents the retries and renames a support file." },
    { base: second, head: third, role: "Sends a notification after the job finishes." },
  ];
  const pulls = await Promise.all(
    revisions.map(async (revision, index) => {
      const reviewFile = path.join(directory, "review-" + index + ".json");
      await writeFile(
        reviewFile,
        JSON.stringify({
          pull: { repository: "example/project", baseSha: revision.base, headSha: revision.head },
          findings: [],
          skippedPaths: [],
        }),
      );
      return {
        id: "pr-" + (index + 1),
        repository: "example/project",
        number: index + 1,
        url: "https://github.com/example/project/pull/" + (index + 1),
        title: "Change " + (index + 1),
        role: revision.role,
        checkout: directory,
        baseSha: revision.base,
        headSha: revision.head,
        reviewFile,
        ci: [],
      };
    }),
  );
  const input = {
    title: "Review retries and notifications",
    summary: "Follow one connected behavior across three PRs.",
    overview: {
      problem: "A failed job loses its work, and nobody hears about it.",
      outcome: "The job retries three times and then notifies its owner.",
      approach: "A retry count wraps the job. A notify flag runs after the last attempt.",
      terms: [{ term: "Attempt", meaning: "One run of the job callback." }],
    },
    pulls,
    evidence: [
      {
        id: "retry",
        pr: "pr-1",
        path: "job.ts",
        side: "HEAD",
        start: 1,
        end: 1,
        quote: "export const attempts = 3;",
      },
    ],
    groups: [
      {
        id: "flow",
        title: "Trace the job",
        prs: pulls.map((pull) => pull.id),
        summary: "PR 1 changes retries. PR 3 enables notifications.",
        why: "Follow their combined result.",
        before: "One attempt, no notification.",
        after: "Three attempts, with notifications.",
        files: [
          { pr: "pr-1", path: "job.ts" },
          { pr: "pr-2", path: "README.md" },
          { pr: "pr-2", path: "blob.bin" },
          { pr: "pr-2", path: 'quoted "name".txt' },
          { pr: "pr-3", path: "job.ts" },
        ],
        steps: [
          {
            title: "Read the constants",
            text: "Inspect the changed defaults.",
            evidence: ["retry"],
          },
        ],
      },
    ],
  };
  const inputPath = path.join(directory, "input.json");
  const outputPath = path.join(directory, "review.html");
  await writeFile(inputPath, JSON.stringify(input));
  return { directory, input, inputPath, outputPath, base, first, second, third };
}

export function build(options: { readonly inputPath: string; readonly outputPath: string }) {
  return command({
    script: "scripts/build.mjs",
    arguments: [options.inputPath, options.outputPath],
  });
}

export function embedded(html: string): unknown {
  const encoded = /<script type="application\/json" id="review-data">([\s\S]*?)<\/script>/.exec(
    html,
  )?.[1];
  if (!encoded) throw new Error("No saved review data.");
  return JSON.parse(encoded);
}
