import path from "node:path";
import { renderReference, referenceRelativePath } from "../../../references";
import { ownedWrite } from "../../../storage";
import { command } from "../../transfer/command";
import { fingerprint } from "../../transfer/structured";
import { historicalSources } from "../sourceEvidence";
import { guidanceDirectory, readGuidanceReceipt, saveGuidanceReceipt, saveGuidanceSuite } from "../store";
import { runValidation } from "../validation";
import { validationFixture } from "../validation.fixtures";
import { correctedPath, incorrectPath, referencePath } from "./change";
import { runMaintenance } from "./index";
import { prepareMaintenanceSuite } from "./prepare";

export async function maintenanceFixture(options: { readonly prepare?: boolean } = {}) {
  const fixture = await validationFixture();
  const record = { schema: 1 as const, key: "reference_second_source", title: "Second source", summary: "Use the documented command.", tags: [],
    source: "claude-memory" as const, sourceLocator: "synthetic/reference.md", updatedAt: "2026-09-19T00:00:00.000Z",
    scope: "global" as const, originDirectory: null, repositoryName: null, body: `Mock used exports. See ${incorrectPath}.` };
  const referenceContent = renderReference(record);
  const relativePath = referenceRelativePath(record);
  const referenceFile = path.join(fixture.paths.profileDirectory, relativePath);
  await Bun.write(referenceFile, referenceContent);
  await Bun.write(path.join(fixture.directory, correctedPath), "export const testName = true;\n");
  await command({ arguments: ["git", "add", "--", correctedPath], cwd: fixture.directory });
  await command({ arguments: ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Synthetic path evidence"], cwd: fixture.directory });
  const baseCommit = await command({ arguments: ["git", "rev-parse", "HEAD"], cwd: fixture.directory });
  const suite = { ...fixture.parent.suite, baseCommit,
    memory: [...fixture.parent.suite.memory, { relativePath: historicalSources[0], content: "Focused command.\nVerified 2026-09-08 by the recorded source, not this session." },
      { relativePath: historicalSources[1], content: `Mock used exports. See ${incorrectPath}.` }],
    references: [...fixture.parent.suite.references, { relativePath: referencePath, content: referenceContent }],
    scenarios: fixture.parent.suite.scenarios.map((scenario) => scenario.id === "memory" ? { ...scenario, criteria: [{
      id: "focused-test-command", dimension: "shared-memory" as const, requirement: "Give a focused command.",
      source: { path: historicalSources[0], quote: "Focused command." }, check: "judged" as const,
    }] } : scenario),
  };
  const original = { ...fixture.parent, suite, suiteFingerprint: fingerprint(suite) };
  await saveGuidanceSuite({ paths: fixture.paths, suite });
  await saveGuidanceReceipt({ paths: fixture.paths, receipt: original });
  const initialized = await runValidation({ options: fixture.options, execute: async (request) => readGuidanceReceipt({ paths: fixture.paths, evalId: request.evalId ?? "" }) });
  const parent = { ...initialized, status: "complete" as const, runs: [0, 1].flatMap((repeat) => original.runs.map((run) => ({ ...run, repeat }))) };
  await saveGuidanceReceipt({ paths: fixture.paths, receipt: parent });
  const parentDirectory = guidanceDirectory({ paths: fixture.paths, evalId: parent.evalId });
  const parentBudget = { version: 1, limitUsd: parent.limitUsd, spentUsd: 6.5293998, calls: 48, maximumCalls: 48, pending: false, unknownCost: false };
  await ownedWrite({ path: path.join(parentDirectory, "budget.json"), content: JSON.stringify(parentBudget) });
  const prepared = options.prepare === false ? null : await prepareMaintenanceSuite({ paths: fixture.paths, parentEvalId: parent.evalId });
  const request = { ...fixture.options, validationOf: undefined, cumulativeBudgetUsd: undefined, maintenanceOf: parent.evalId,
    additionalBudgetUsd: 10, suiteId: prepared?.suiteId };
  const initialize = () => runMaintenance({ options: request, execute: async (child) => readGuidanceReceipt({ paths: fixture.paths, evalId: child.evalId ?? "" }) });
  return { ...fixture, original, parent, parentDirectory, parentBudget, referenceFile, referenceContent, prepared, request, initialize };
}
