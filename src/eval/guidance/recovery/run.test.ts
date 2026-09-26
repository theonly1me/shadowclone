import { expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { defaultConfig, writeConfig } from "../../../config";
import type { EngineRunner } from "../../../engine";
import { canonicalPath } from "../../../paths";
import { command } from "../../transfer/command";
import { fingerprint } from "../../transfer/structured";
import { runGuidanceEvaluation } from "../run";
import { readGuidanceReceipt, saveGuidanceReceipt, saveGuidanceSuite } from "../store";
import { recoveryFixture } from "./fixtures";

test("recovery grades the saved candidate first and uses exactly 23 more invocations", async () => {
  const fixture = await recoveryFixture();
  try {
    const repository = canonicalPath(path.join(fixture.root, "repository"));
    await mkdir(repository);
    await command({ arguments: ["git", "init", "--quiet"], cwd: repository });
    await Bun.write(path.join(repository, "README.md"), "Synthetic recovery repository.\n");
    await command({ arguments: ["git", "add", "README.md"], cwd: repository });
    await command({ arguments: ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Fixture"], cwd: repository });
    const suite = { ...fixture.receipt.suite, repository, baseCommit: await command({ arguments: ["git", "rev-parse", "HEAD"], cwd: repository }) };
    const receipt = { ...fixture.receipt, suite, suiteFingerprint: fingerprint(suite) };
    await saveGuidanceSuite({ paths: fixture.paths, suite });
    await saveGuidanceReceipt({ paths: fixture.paths, receipt });
    await writeConfig({ configPath: fixture.paths.configFile, config: { ...defaultConfig,
      sources: { ...defaultConfig.sources, "git-metadata": true }, distillation: { deep: true } } });
    let calls = 0;
    let executions = 0;
    const runner: EngineRunner = async (request) => {
      calls += 1;
      expect(request.maxBudgetUsd).toBeCloseTo(5 - 0.262548 - (calls - 1) / 100);
      if (calls === 1) expect(request.outputSchema).toBeDefined();
      if (!request.outputSchema) {
        executions += 1;
        if (request.execution.purpose === "evaluation" && request.execution.access === "write") await Bun.write(path.join(request.cwd, "result.ts"), "export const completeName = true;\n");
      }
      return { engine: "claude-code", resolvedModel: "claude-sonnet-5", sessionId: "fixture", transcriptPath: null, text: "Use a separate retry budget.",
        structured: { checks: [{ id: "complete-names", verdict: "pass", evidence: "Uses complete names." }] },
        costUsd: 0.01, durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
    };
    const options = { repo: repository, model: receipt.model, pilot: true, maxBudgetUsd: 5, maximumCalls: 28, deadlineSeconds: 1500,
      paths: fixture.paths, runner, verifyContract: async () => fixture.proof, evalId: receipt.evalId };
    await expect(runGuidanceEvaluation(options)).rejects.toThrow("Original guidance deadline");
    expect(await readGuidanceReceipt({ paths: fixture.paths, evalId: receipt.evalId })).toEqual(receipt);
    const completed = await runGuidanceEvaluation({ ...options, recoverPreflightFailure: true, failedCliVersion: fixture.failedCliVersion });
    expect(completed.status).toBe("complete");
    expect(completed.runs).toHaveLength(8);
    expect(completed.runs.flatMap((candidate) => candidate.votes)).toHaveLength(16);
    expect(completed.runs[0]?.evidence).toBe(receipt.runs[0]?.evidence);
    expect(calls).toBe(23);
    expect(executions).toBe(7);
    const budget = await Bun.file(path.join(fixture.directory, "budget.json")).json();
    expect(budget.calls).toBe(25);
    expect(budget.spentUsd).toBeCloseTo(0.492548);
    expect(budget.unknownCost).toBeFalse();
    const repeated = await runGuidanceEvaluation({ ...options, recoverPreflightFailure: true, failedCliVersion: fixture.failedCliVersion });
    expect(repeated.deadlineAt).toBe(completed.deadlineAt);
    expect(calls).toBe(23);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
}, 30000);
