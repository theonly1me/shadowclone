import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { guidedReportSchema, preparedReviewSchema, type GuidedEngine } from "./index";

import { draftBoundaryFixture } from "./boundary.fixtures";

export async function draftFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guided-draft-fixture-"));
  const checkout = path.join(directory, "repository");
  await Bun.write(path.join(checkout, "job.ts"), "export const limit = 1;\n");
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
  git(["remote", "add", "origin", "https://github.com/example/project.git"]);
  git(["add", "."]);
  git(["commit", "-m", "feat: initial job"]);
  const baseSha = git(["rev-parse", "HEAD"]);
  await Bun.write(path.join(checkout, "job.ts"), "export const limit = 3;\n");
  git(["add", "."]);
  git(["commit", "-m", "feat: retry job"]);
  const headSha = git(["rev-parse", "HEAD"]);
  const url = "https://github.com/example/project/pull/1";
  const pull = {
    id: "pr-1",
    repository: "example/project",
    number: 1,
    title: "Retry the job",
    url,
    baseSha,
    headSha,
    mergeBaseSha: baseSha,
    files: [
      {
        path: "job.ts",
        oldPath: "job.ts",
        status: "M",
        binary: false,
        diff: git(["diff", "--unified=5", baseSha, headSha]),
        base: "export const limit = 1;\n",
        head: "export const limit = 3;\n",
        additions: 1,
        deletions: 1,
        rows: [],
      },
    ],
    ci: [],
  };
  const reportId = createHash("sha256")
    .update(JSON.stringify([[pull.repository, 1, baseSha, headSha]]))
    .digest("hex");
  const data = {
    version: 1,
    reportId,
    title: "Understand retries",
    generatedAt: "2026-01-01T00:00:00Z",
    summary: "Trace the limit.",
    pulls: [pull],
    evidence: [
      {
        id: "limit",
        pr: "pr-1",
        path: "job.ts",
        side: "HEAD",
        start: 1,
        end: 1,
        text: "export const limit = 3;",
        quote: "export const limit = 3;",
        sha: headSha,
      },
    ],
    groups: [
      {
        id: "retry",
        title: "Retry state",
        summary: "The job uses three attempts.",
        why: "Temporary failures can retry.",
        before: "One attempt.",
        after: "Three attempts.",
        prs: ["pr-1"],
        evidence: ["limit"],
        files: [{ pr: "pr-1", path: "job.ts" }],
        steps: [],
        dryRuns: [],
        diagram: { nodes: [], edges: [] },
      },
    ],
    proposals: [],
    coverage: [{ pr: "pr-1", path: "job.ts", status: "reviewed", reason: "Synthetic fixture." }],
    stackEdges: [],
    combinedHead: headSha,
  };
  const report = guidedReportSchema.parse(data);
  const note = {
    id: "human-note",
    author: "human",
    pr: "pr-1",
    anchor: "group-retry",
    body: "ask about the three attempt limit",
    originalBody: "ask about the three attempt limit",
    quote: "export const limit = 3;",
    source: { path: "job.ts", side: "HEAD", start: 1, end: 1 },
    evidence: ["limit"],
    selected: true,
    dismissed: false,
  };
  const input = { reportId, pr: "pr-1", notes: [note] };
  const reply = preparedReviewSchema.parse({
    comments: [
      {
        noteIds: ["human-note"],
        path: "job.ts",
        side: "RIGHT",
        startLine: 1,
        line: 1,
        body: "Can we document why the limit is three?",
        quote: "export const limit = 3;",
      },
    ],
    held: [],
  });
  const { state, github, runner } = draftBoundaryFixture({ headSha, baseSha, url, reply });
  const engine: GuidedEngine = { id: "claude-code", runner };
  const options = {
    report,
    input,
    checkout,
    github,
    engine,
    login: "example-reviewer",
    receiptDirectory: path.join(directory, "receipts"),
    guidance: "Synthetic review voice: use direct questions.",
  };
  return {
    directory,
    checkout,
    git,
    baseSha,
    headSha,
    data,
    report,
    input,
    state,
    engine,
    github,
    options,
  };
}
