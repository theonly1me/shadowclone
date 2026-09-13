import type { ManagedPolicy } from "../config";
import {
  distillSignals,
  renderReconciliationChanges,
} from "../distill";
import {
  defaultLearningExecutionLimits,
  createLearningExecution,
  learningExecutionLimitsForCalls,
  detectEngine,
  type EngineId,
  type EngineRunner,
  type LearningExecution,
  type LearningExecutionLimits,
  type ReasoningEffort,
} from "../engine";
import type { IndexedEvent } from "../index";
import type { ProjectPaths } from "../paths";
import { getProviderByEngine } from "../provider";
import {
  effectiveProfileStatus,
  readProfileSnapshot,
  type ProfileRule,
  type ProfileSnapshot,
  writeProfile,
} from "../profile";
import type { CorrectionSignal } from "../signal";
import { loadSeedLibrary } from "../skills";
import { refreshIntegrations } from "../integrations";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";

export type DeepLearningResult = {
  readonly changesProposed: number;
  readonly networkCallsMade: boolean;
  readonly profileUpdated: boolean;
  readonly execution: LearningExecution;
};

function normalizeExplicitCandidates(profile: ProfileSnapshot): {
  readonly profile: ProfileSnapshot;
  readonly promoted: readonly ProfileRule[];
} {
  const promoted: ProfileRule[] = [];
  const rules = profile.rules.map((snapshot) => {
    const status = effectiveProfileStatus(snapshot.rule);
    if (status === snapshot.rule.status) {
      return snapshot;
    }
    const rule: ProfileRule = { ...snapshot.rule, status };
    promoted.push(rule);
    return { ...snapshot, rule };
  });
  return { profile: { ...profile, rules }, promoted };
}

export async function runDeepLearning(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly events: readonly IndexedEvent[];
  readonly paths: ProjectPaths;
  readonly policy: ManagedPolicy;
  readonly runner?: EngineRunner;
  readonly engine?: EngineId;
  readonly model?: string;
  readonly reasoningEffort?: ReasoningEffort;
  readonly maximumCalls?: number;
  readonly limits?: LearningExecutionLimits;
  readonly execution?: LearningExecution;
  readonly dryRun: boolean;
  readonly apply: boolean;
  readonly confirm?: ConfirmPrompt;
  readonly writeLine?: (line: string) => void;
}): Promise<DeepLearningResult> {
  const writeLine = options.writeLine ?? console.log;
  if (options.policy.distillation !== "allowed") {
    throw new Error("Managed policy does not allow remote distillation");
  }
  if (
    options.engine &&
    !options.policy.allowedEngines.includes(options.engine)
  ) {
    throw new Error("Managed policy blocks the selected learning engine");
  }
  const detection = options.runner
    ? null
    : await detectEngine({
        purpose: "distill",
        allowedEngines: options.engine
          ? [options.engine]
          : options.policy.allowedEngines,
      });
  const detectedRunner = options.runner ?? detection?.runner;
  const engine = options.engine ?? detection?.selectedEngine;
  if (!detectedRunner || !engine) {
    throw new Error("No authenticated agent engine is available");
  }
  const runner: EngineRunner = (run) => detectedRunner({
    ...run,
    ...(options.model ? { model: options.model } : {}),
    ...(options.reasoningEffort
      ? { reasoningEffort: options.reasoningEffort }
      : {}),
  });
  const limits = options.limits ?? (options.maximumCalls === undefined
    ? defaultLearningExecutionLimits
    : learningExecutionLimitsForCalls(options.maximumCalls));
  const execution = options.execution ?? createLearningExecution({
    engine,
    runner,
    limits,
  });
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
  const [storedProfile, seedLibrary] = await Promise.all([
    readProfileSnapshot(options.paths),
    loadSeedLibrary(),
  ]);
  const normalized = normalizeExplicitCandidates(storedProfile);
  const result = await distillSignals({
    signals: options.signals,
    runner,
    engine,
    limits,
    execution,
    workingDirectory: options.paths.shadowcloneDirectory,
    checkpointDirectory: options.dryRun ? null : options.paths.distillDirectory,
    events: options.events,
    profile: normalized.profile,
    seedLibrary,
  });
  writeLine(renderReconciliationChanges({
    changes: result.changes,
    rejectedMatches: result.rejectedMatches,
  }));
  let profileUpdated = false;
  if (!options.dryRun) {
    const accepted = result.rules.length === 0 || options.apply ||
      await (options.confirm ?? promptConfirmation)(
        "Apply these profile changes?",
      );
    const updates = [
      ...normalized.promoted,
      ...(accepted ? result.rules : []),
    ];
    if (updates.length > 0) {
      const rules = [...new Map(
        updates.map((rule) => [rule.key, rule]),
      ).values()].sort(
        (left, right) =>
          right.observations - left.observations ||
          left.title.localeCompare(right.title),
      );
      await writeProfile({ paths: options.paths, rules });
      if (normalized.promoted.length > 0) {
        writeLine(
          `Activated ${normalized.promoted.length} explicit profile rule(s).`,
        );
      }
      const refreshed = await refreshIntegrations({ paths: options.paths, configPath: options.paths.configFile });
      if (refreshed.preserved > 0) writeLine(`Preserved ${refreshed.preserved} edited or unavailable integration(s).`);
      profileUpdated = true;
    }
  }
  return {
    changesProposed: result.rules.length,
    networkCallsMade: result.engineRuns > 0,
    profileUpdated,
    execution,
  };
}
