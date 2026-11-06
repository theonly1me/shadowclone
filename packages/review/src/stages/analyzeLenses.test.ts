import { expect, test } from "bun:test";
import type { EngineRunOptions } from "@shadowclone/agents";
import { collectReview } from "../collect";
import { parseDiff } from "../collect/diff";
import { createGitFixture } from "../collect/gitFixture";
import { coveredAnswer, engineRun } from "../engineFixture";
import { reviewHunks } from "../hunks";
import { lensAssignments } from "../lenses";
import type { Finding } from "../types";
import { analyzeStage } from "./analyze";
import type { PacketFile } from "./schemas";

const transactionLens = "This run is the Transactions and concurrency lens";
const moveSource = "export async function move(db: Db): Promise<void> {\n  await db.transaction(async () => undefined);\n}\n";

function addedFileDiff(options: { readonly path: string; readonly lines: readonly string[] }): string {
  return `diff --git a/${options.path} b/${options.path}\nnew file mode 100644\n--- /dev/null\n+++ b/${options.path}\n@@ -0,0 +1,${options.lines.length} @@\n${options.lines.map((line) => `+${line}`).join("\n")}\n`;
}

async function transactionPacket(): Promise<{ readonly packet: PacketFile; readonly checkout: string }> {
  const fixture = await createGitFixture();
  await fixture.write({ "README.md": "base\n" });
  const baseSha = fixture.commit("base");
  await fixture.write({ "src/move.ts": moveSource });
  const headSha = fixture.commit("head");
  const context = await collectReview({
    checkout: fixture.directory,
    facts: { repository: "example/app", number: 1, title: "t", body: "", baseRefName: "main", baseSha, headSha },
  });

  return { packet: { version: 1, context, ruleHits: [], reports: [] }, checkout: fixture.directory };
}

const lensFinding: Finding = {
  path: "src/move.ts",
  line: 2,
  severity: "high",
  category: "correctness",
  source: "investigation",
  title: "Two moves can run at once",
  explanation: "Nothing locks the row before the transaction.",
  failureScenario: "Two requests move the same record twice.",
  evidence: [{ source: "code", location: "src/move.ts:2", quote: "await db.transaction(async () => undefined);" }],
  rule: null,
  suggestion: null,
  refutation: "No lock exists in the repository.",
  candidates: [],
};

function lensRunner(options: { readonly prompts: string[]; readonly failLens: boolean }) {
  return async (run: EngineRunOptions) => {
    options.prompts.push(run.prompt);
    const isLens = run.prompt.includes(transactionLens);

    if (isLens && options.failLens) {
      return engineRun({ isError: true, errorMessage: "rate limited" });
    }

    return engineRun({ structured: coveredAnswer({ answer: { findings: isLens ? [lensFinding] : [], dropped: [] }, prompt: run.prompt }) });
  };
}

test("a hunk that opens a transaction gets the transactions lens, and a change to docs gets no lens", () => {
  const code = parseDiff(addedFileDiff({ path: "src/move.ts", lines: moveSource.trimEnd().split("\n") }));
  const docs = parseDiff(addedFileDiff({ path: "docs/usage.md", lines: ["# Usage", "Run the command."] }));

  expect(lensAssignments(reviewHunks(code)).map((assignment) => assignment.lens.id)).toEqual(["transactions"]);
  expect(lensAssignments(reviewHunks(docs))).toEqual([]);
});

test("a lens run reports a finding that the part run missed", async () => {
  const { packet, checkout } = await transactionPacket();
  const prompts: string[] = [];
  const result = await analyzeStage({
    packet,
    checks: null,
    checkout,
    reviewModel: { runner: lensRunner({ prompts, failLens: false }), model: "m", effort: null, network: false, lenses: { enabled: true, maxCostUsd: 10 } },
  });

  expect(prompts.filter((prompt) => prompt.includes(transactionLens))).toHaveLength(1);
  expect([result.findings.map((finding) => finding.title), result.statistics.lensRuns]).toEqual([["Two moves can run at once"], 1]);
});

test("lens runs stop when the part runs used the cost limit, and the result names each lens that did not run", async () => {
  const { packet, checkout } = await transactionPacket();
  const prompts: string[] = [];
  const result = await analyzeStage({
    packet,
    checks: null,
    checkout,
    reviewModel: { runner: lensRunner({ prompts, failLens: false }), model: "m", effort: null, network: false, lenses: { enabled: true, maxCostUsd: 0.5 } },
  });

  expect(prompts.some((prompt) => prompt.includes(transactionLens))).toBe(false);
  expect(result.statistics.lensesSkipped).toEqual(["Transactions and concurrency: the part runs used $0.50 of the $0.50 limit"]);
});

test("a lens run that fails is named in the result, and the review keeps the part findings", async () => {
  const { packet, checkout } = await transactionPacket();
  const result = await analyzeStage({
    packet,
    checks: null,
    checkout,
    reviewModel: { runner: lensRunner({ prompts: [], failLens: true }), model: "m", effort: null, network: false, lenses: { enabled: true, maxCostUsd: null } },
  });

  expect([result.statistics.lensRuns, result.statistics.lensesSkipped]).toEqual([0, ["Transactions and concurrency: The review run failed: rate limited"]]);
});
