import { expect, test } from "bun:test";
import path from "node:path";
import type { EngineRunner } from "../../engine";
import { ownedWrite } from "../../storage";
import { candidateFixture } from "./fixtures";
import { runGuidanceEvaluation } from "./run";
import { guidanceDirectory, readGuidanceReceipt, saveGuidanceReceipt } from "./store";
import { runValidation } from "./validation";
import { validationFixture } from "./validation.fixtures";

test("linked validation resumes a saved candidate and vote for exactly 48 cumulative child calls", async () => {
  const fixture = await validationFixture();
  try {
    const initialized = await runValidation({ options: fixture.options, execute: async (request) => readGuidanceReceipt({ paths: fixture.paths, evalId: request.evalId ?? "" }) });
    const directory = guidanceDirectory({ paths: fixture.paths, evalId: initialized.evalId });
    const candidate = { ...candidateFixture(), arm: "bare" as const, votes: [{ vote: 1, checks: [{ id: "complete-names", verdict: "pass" as const, evidence: "Saved vote" }] }] };
    await saveGuidanceReceipt({ paths: fixture.paths, receipt: { ...initialized, runs: [candidate] } });
    const budgetPath = path.join(directory, "budget.json");
    await ownedWrite({ path: budgetPath, content: JSON.stringify({ version: 1, limitUsd: initialized.limitUsd, spentUsd: 0.02, calls: 2, maximumCalls: 48, pending: false, unknownCost: false }) });
    let calls = 2;
    let generations = 1;
    const runner: EngineRunner = async (request) => {
      calls += 1;
      expect(request.maxBudgetUsd).toBeCloseTo(initialized.limitUsd - (calls - 1) / 100);
      if (calls === 3) expect(request.outputSchema).toBeDefined();
      if (!request.outputSchema) {
        generations += 1;
        if (request.execution.purpose === "evaluation" && request.execution.access === "write") await Bun.write(path.join(request.cwd, "result.ts"), "export const completeName = true;\n");
        expect(request.prompt).not.toContain("repositoryEvidence");
      }
      return { engine: "claude-code", resolvedModel: "claude-sonnet-5", sessionId: "fixture", transcriptPath: null, text: "Use complete names.",
        structured: { checks: [{ id: "complete-names", verdict: "pass", evidence: "Uses complete names." }] }, costUsd: 0.01,
        durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
    };
    const result = await runGuidanceEvaluation({ ...fixture.options, runner });
    expect(result.status).toBe("complete");
    expect(result.runs).toHaveLength(16);
    expect(result.runs.flatMap((run) => run.votes)).toHaveLength(32);
    expect(result.runs[0]?.evidence).toBe(candidate.evidence);
    expect(result.runs[0]?.votes[0]).toEqual(candidate.votes[0]);
    expect(result.deadlineAt).toBe(initialized.deadlineAt);
    expect(generations).toBe(16);
    expect(calls).toBe(48);
    const ledger = await Bun.file(budgetPath).json();
    expect(ledger.calls + fixture.parentBudget.calls).toBe(73);
    expect(ledger.spentUsd).toBeCloseTo(0.48);
    await runGuidanceEvaluation({ ...fixture.options, runner });
    expect(calls).toBe(48);
    expect(await Bun.file(path.join(fixture.parentDirectory, "budget.json")).json()).toEqual(fixture.parentBudget);
  } finally { await fixture.cleanup(); }
}, 30000);

test("a resolved model mismatch stops after one accounted invocation", async () => {
  const fixture = await validationFixture();
  try {
    let calls = 0;
    const runner: EngineRunner = async () => {
      calls += 1;
      return { engine: "claude-code", resolvedModel: "claude-sonnet-5-other", sessionId: "fixture", transcriptPath: null, text: "Synthetic mismatch",
        structured: null, costUsd: 0.01, durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
    };
    const result = await runGuidanceEvaluation({ ...fixture.options, runner });
    expect(result.status).toBe("error");
    expect(result.failure).toContain("differs from the original pilot");
    expect(calls).toBe(1);
    const ledger = await Bun.file(path.join(guidanceDirectory({ paths: fixture.paths, evalId: result.evalId }), "budget.json")).json();
    expect(ledger.calls).toBe(1);
    expect(ledger.spentUsd).toBe(0.01);
  } finally { await fixture.cleanup(); }
}, 30000);

test("linked validation preserves unresolved child cost and expired deadlines", async () => {
  const fixture = await validationFixture();
  try {
    const initialized = await runValidation({ options: fixture.options, execute: async (request) => readGuidanceReceipt({ paths: fixture.paths, evalId: request.evalId ?? "" }) });
    const directory = guidanceDirectory({ paths: fixture.paths, evalId: initialized.evalId });
    await ownedWrite({ path: path.join(directory, "budget.json"), content: JSON.stringify({ version: 1, limitUsd: initialized.limitUsd, spentUsd: 0.02, calls: 2, maximumCalls: 48, pending: true, unknownCost: false }) });
    const result = await runGuidanceEvaluation(fixture.options);
    expect(result.status).toBe("error");
    expect(result.failure).toContain("cost unknown");
    expect(await Bun.file(path.join(directory, "budget.json")).json()).toHaveProperty("unknownCost", true);
    await saveGuidanceReceipt({ paths: fixture.paths, receipt: { ...result, deadlineAt: 1 } });
    await expect(runGuidanceEvaluation(fixture.options)).rejects.toThrow("deadline has expired");
    expect((await readGuidanceReceipt({ paths: fixture.paths, evalId: result.evalId })).deadlineAt).toBe(1);
  } finally { await fixture.cleanup(); }
}, 30000);
