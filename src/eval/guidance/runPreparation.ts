import { setupTransferEval } from "../transfer/setup";
import { fingerprint } from "../transfer/structured";
import { prepareGuidanceSuite, validateScenarios } from "./prepare";
import type { GuidanceOptions } from "./runOptions";
import type { GuidanceReceipt } from "./schema";
import { readGuidanceReceipt, readGuidanceSuite } from "./store";

export async function prepareGuidanceRun(options: GuidanceOptions) {
  if (options.maxBudgetUsd === undefined) {
    throw new Error("An explicit evaluation budget is required");
  }

  if (
    options.pilot &&
    options.maxBudgetUsd > 5 &&
    !options.validationRun &&
    !options.maintenanceRun
  ) {
    throw new Error("Pilot budget cannot exceed $5");
  }

  if (
    options.recoverPreflightFailure &&
    (!options.evalId || !options.failedCliVersion)
  ) {
    throw new Error(
      "Preflight recovery requires an existing receipt and observed CLI version",
    );
  }

  const engine = options.engine ?? "claude-code";

  if (
    engine === "codex" &&
    (options.protocol !== "guidance-skills-v1" ||
      options.recoverPreflightFailure)
  ) {
    throw new Error("Codex guidance requires the skills protocol");
  }

  const setup = await setupTransferEval({
    repo: options.repo,
    engine,
    model: options.model,
    reasoningEffort: "medium",
    paths: options.paths,
    runner: options.runner,
  });

  const saved = options.evalId
    ? await readGuidanceReceipt({ paths: setup.paths, evalId: options.evalId })
    : null;

  if (saved && (saved.engine ?? "claude-code") !== engine) {
    throw new Error("Resume must retain the original engine");
  }

  if (saved?.validation && !options.validationRun) {
    throw new Error("Resume linked validation with --validation-of");
  }

  if (saved?.maintenance && !options.maintenanceRun) {
    throw new Error("Resume maintenance with --maintenance-of");
  }

  if (saved?.comparison && !options.comparisonRun) {
    throw new Error("Resume comparison with --comparison-of");
  }

  const suite =
    saved?.suite ??
    (options.suiteId
      ? await readGuidanceSuite({
          paths: setup.paths,
          suiteId: options.suiteId,
        })
      : options.scenarioFile && options.memorySource
        ? await prepareGuidanceSuite({
            setup,
            protocol: options.protocol ?? "guidance-v1",
            scenarioFile: options.scenarioFile,
            memorySource: options.memorySource,
            memoryManifest: options.memoryManifest,
          })
        : null);

  if (!suite) {
    throw new Error(
      "Provide a frozen suite or scenario file with an explicit memory source",
    );
  }

  if (options.protocol && suite.protocol !== options.protocol) {
    throw new Error("Frozen suite protocol does not match the request");
  }

  validateScenarios(suite);

  if (suite.repository !== setup.repository) {
    throw new Error("Frozen suite belongs to a different repository");
  }

  if (
    saved &&
    (saved.model !== options.model ||
      saved.limitUsd !== options.maxBudgetUsd ||
      saved.maximumCalls !== options.maximumCalls ||
      saved.pilot !== options.pilot)
  ) {
    throw new Error(
      "Resume must retain model, condition selection, and original limits",
    );
  }

  if (
    saved &&
    fingerprint(
      await readGuidanceSuite({
        paths: setup.paths,
        suiteId: saved.suite.suiteId,
      }),
    ) !== saved.suiteFingerprint
  ) {
    throw new Error("Frozen suite changed since the original evaluation");
  }

  const receipt: GuidanceReceipt = saved ?? {
    protocol: suite.protocol,
    schemaVersion: 1,
    evalId: setup.evalId,
    suite,
    suiteFingerprint: fingerprint(suite),
    model: options.model,
    effort: "medium",
    ...(engine === "codex" ? { engine } : {}),
    pilot: options.pilot,
    repeat: options.pilot ? 1 : 2,
    maximumCalls: options.maximumCalls,
    limitUsd: options.maxBudgetUsd,
    deadlineAt: Date.now() + options.deadlineSeconds * 1000,
    status: "ready",
    failure: null,
    runs: [],
  };

  return { setup, saved, suite, engine, receipt };
}
