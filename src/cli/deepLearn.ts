import { captureRoots } from "../redact";
import type { ManagedPolicy } from "../config";
import {
  distillSignals,
  renderReconciliationChanges,
} from "../distill";
import {
  defaultLearningExecutionLimits,
  detectEngine,
  type EngineId,
  type EngineRunner,
} from "../engine";
import type { IndexedEvent } from "../index";
import type { ProjectPaths } from "../paths";
import { getProviderByEngine } from "../provider";
import {
  readProfileSnapshot,
  writeProfile,
} from "../profile";
import type { CorrectionSignal } from "../signal";
import { loadSeedLibrary } from "../skills";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";

export type DeepLearningResult = {
  readonly changesProposed: number;
  readonly networkCallsMade: boolean;
  readonly profileUpdated: boolean;
};

export async function runDeepLearning(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly events: readonly IndexedEvent[];
  readonly paths: ProjectPaths;
  readonly policy: ManagedPolicy;
  readonly runner?: EngineRunner;
  readonly engine?: EngineId;
  readonly dryRun: boolean;
  readonly apply: boolean;
  readonly confirm?: ConfirmPrompt;
  readonly writeLine?: (line: string) => void;
}): Promise<DeepLearningResult> {
  const writeLine = options.writeLine ?? console.log;
  if (options.policy.distillation !== "allowed") {
    throw new Error("Managed policy does not allow remote distillation");
  }
  const detection = options.runner
    ? null
    : await detectEngine({
        purpose: "distill",
        allowedEngines: options.policy.allowedEngines,
      });
  const runner = options.runner ?? detection?.runner;
  const engine = options.engine ?? detection?.selectedEngine;
  if (!runner || !engine) {
    throw new Error("No authenticated agent engine is available");
  }
  const limits = defaultLearningExecutionLimits;
  const supportsCostLimit =
    getProviderByEngine(engine)?.engine?.capabilities.maxBudgetUsd === true;
  writeLine(
    [
      `Learning is limited to ${limits.maximumCalls} total calls and ${limits.timeoutMilliseconds / 1_000} seconds`,
      supportsCostLimit
        ? ` with a $${limits.maximumCostUsd.toFixed(2)} total ceiling.`
        : ".",
    ].join(""),
  );
  const [profile, seedLibrary] = await Promise.all([
    readProfileSnapshot(options.paths),
    loadSeedLibrary(),
  ]);
  const result = await distillSignals({
    signals: options.signals,
    sourceRoots: captureRoots(options.paths),
    runner,
    engine,
    limits,
    workingDirectory: options.paths.shadowcloneDirectory,
    checkpointDirectory: options.dryRun ? null : options.paths.distillDirectory,
    events: options.events,
    profile,
    seedLibrary,
  });
  writeLine(renderReconciliationChanges({
    changes: result.changes,
    rejectedMatches: result.rejectedMatches,
  }));
  let profileUpdated = false;
  if (!options.dryRun && result.rules.length > 0) {
    const accepted = options.apply || await (options.confirm ?? promptConfirmation)(
      "Apply these profile changes?",
    );
    if (accepted) {
      const rules = result.rules.slice().sort(
        (left, right) =>
          right.observations - left.observations ||
          left.title.localeCompare(right.title),
      );
      await writeProfile({ paths: options.paths, rules });
      profileUpdated = true;
    }
  }
  return {
    changesProposed: result.rules.length,
    networkCallsMade: result.engineRuns > 0,
    profileUpdated,
  };
}
