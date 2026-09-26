import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../../config";
import type { EngineRunner } from "../../engine";
import { canonicalPath, createProjectPaths } from "../../paths";
import { ownedWrite } from "../../storage";
import { command } from "../transfer/command";
import { fingerprint } from "../transfer/structured";
import { candidateFixture, guidanceFixture, contractFixture } from "./fixtures";
import { judgeEvidencePaths } from "./judgeEvidence";
import { arms, type GuidanceReceipt } from "./schema";
import { guidanceDirectory, saveGuidanceReceipt, saveGuidanceSuite } from "./store";
import { deliveryTrace } from "./trace";

export async function validationFixture() {
  const directory = canonicalPath(await mkdtemp(path.join(os.tmpdir(), "validation-fixture-")));
  const paths = createProjectPaths({ homeDirectory: directory, platform: "freebsd" });
  await writeConfig({ configPath: paths.configFile, config: { ...defaultConfig, sources: { ...defaultConfig.sources, "git-metadata": true }, distillation: { deep: true } } });
  await command({ arguments: ["git", "init", "--quiet"], cwd: directory });
  for (const relative of judgeEvidencePaths) await Bun.write(path.join(directory, relative), "Synthetic repository evidence.\n");
  await command({ arguments: ["git", "add", "--", ...judgeEvidencePaths], cwd: directory });
  await command({ arguments: ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Fixture"], cwd: directory });
  const suite = { ...guidanceFixture(), repository: directory, baseCommit: await command({ arguments: ["git", "rev-parse", "HEAD"], cwd: directory }) };
  await saveGuidanceSuite({ paths, suite });
  const parent: GuidanceReceipt = {
    protocol: "guidance-v1", schemaVersion: 1, evalId: crypto.randomUUID(), suite, suiteFingerprint: fingerprint(suite), model: "claude-sonnet-5", effort: "medium",
    cliVersion: contractFixture().cliVersion, pilot: true, repeat: 1, maximumCalls: 28, limitUsd: 5, deadlineAt: 1, status: "complete", failure: null,
    runs: suite.scenarios.filter((scenario) => scenario.pilot).flatMap((scenario) => arms.map((arm) => ({ ...candidateFixture(), scenarioId: scenario.id, arm, complete: true,
      votes: [1, 2].map((vote) => ({ vote, checks: [{ id: "complete-names", verdict: "pass" as const, evidence: "Synthetic" }] })) }))),
  };
  await saveGuidanceReceipt({ paths, receipt: parent });
  const parentBudget = { version: 1, limitUsd: 5, spentUsd: 2.9722378, calls: 25, maximumCalls: 28, pending: false, unknownCost: false };
  const parentDirectory = guidanceDirectory({ paths, evalId: parent.evalId });
  await ownedWrite({ path: path.join(parentDirectory, "budget.json"), content: JSON.stringify(parentBudget) });
  const runner: EngineRunner = async () => { throw new Error("No paid runner in fixture"); };
  const options = { repo: directory, model: "claude-sonnet-5", pilot: false, validationOf: parent.evalId, cumulativeBudgetUsd: 10, runner,
    maximumCalls: 48, deadlineSeconds: 2700, paths, verifyContract: async () => contractFixture(),
    verifyStream: async () => ({ checkedAt: 0, network: "loopback-only", messages: 4, resolvedModel: "claude-sonnet-5", trace: deliveryTrace({ directory, actions: [], scenario: { expectedSkills: [], expectedReferences: [] } }) }) };
  return { directory, paths, parent, parentBudget, parentDirectory, options, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
