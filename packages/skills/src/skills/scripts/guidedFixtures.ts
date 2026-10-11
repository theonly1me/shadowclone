import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { seedSkillsDirectory } from "@shadowclone/core";
import { z } from "zod";

export const collectedFixtureSchema = z.object({
  pulls: z.array(
    z.object({
      id: z.string(),
      headSha: z.string(),
      mergeBaseSha: z.string(),
      files: z.array(
        z.object({
          path: z.string(),
          diff: z.string(),
          additions: z.number(),
          deletions: z.number(),
        }),
      ),
    }),
  ),
  evidence: z.array(z.object({ text: z.string() })),
  stackEdges: z.array(z.object({ from: z.string(), to: z.string() })),
  combinedHead: z.string().nullable(),
});

export async function guidedFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guided-review-fixture-"));
  const checkout = path.join(directory, "repository");
  await Bun.write(path.join(checkout, "job.ts"), "export const attempts = 1;\n");
  await Bun.write(path.join(checkout, "guide.md"), "# Review\n\nBefore **saving**.\n");
  const git = (arguments_: readonly string[]) => {
    const result = Bun.spawnSync(["git", ...arguments_], {
      cwd: checkout,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    return result.stdout.toString().trim();
  };
  git(["init", "--initial-branch=main"]);
  git(["config", "user.name", "Example"]);
  git(["config", "user.email", "example@example.test"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["add", "."]);
  git(["commit", "-m", "feat: initial state"]);
  const baseSha = git(["rev-parse", "HEAD"]);
  await Bun.write(path.join(checkout, "job.ts"), "export const attempts = 3;\n");
  await Bun.write(
    path.join(checkout, "guide.md"),
    "# Review\n\nAfter **saving**.\n<script>alert(1)</script>\n",
  );
  git(["add", "."]);
  git(["commit", "-m", "feat: retry work"]);
  const headSha = git(["rev-parse", "HEAD"]);
  const input = {
    version: 1,
    title: "Review retry behaviour",
    generatedAt: "2026-01-01T00:00:00Z",
    summary: "Follow the job state.",
    pulls: [
      {
        id: "pr-1",
        repository: "example/project",
        number: 1,
        title: "Retry work",
        url: "https://github.com/example/project/pull/1",
        checkout,
        baseSha,
        headSha,
        ci: [],
      },
    ],
    evidence: [
      {
        id: "attempts",
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
        id: "retry",
        title: "Retry the job",
        summary: "The job allows three attempts.",
        why: "A transient failure can retry.",
        before: "One attempt.",
        after: "Three attempts.",
        prs: ["pr-1"],
        evidence: ["attempts"],
        files: [
          { pr: "pr-1", path: "job.ts" },
          { pr: "pr-1", path: "guide.md" },
        ],
        steps: [
          {
            title: "Read the limit",
            text: "The caller reads three attempts.",
            evidence: ["attempts"],
          },
        ],
        dryRuns: [],
        diagram: { nodes: [], edges: [] },
      },
    ],
    proposals: [],
    coverage: [],
  };
  const inputPath = path.join(directory, "input.json");
  await Bun.write(inputPath, JSON.stringify(input));
  return { directory, checkout, git, baseSha, headSha, input, inputPath };
}

export async function guidedScript(options: {
  readonly name: string;
  readonly arguments: readonly string[];
  readonly runtime?: string;
}) {
  const script = path.join(
    await seedSkillsDirectory(),
    "guided-pr-review",
    "scripts",
    options.name + ".mjs",
  );
  const result = Bun.spawnSync(
    [options.runtime ?? process.execPath, script, ...options.arguments],
    { stdout: "pipe", stderr: "pipe" },
  );
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString(),
    error: result.stderr.toString(),
  };
}
