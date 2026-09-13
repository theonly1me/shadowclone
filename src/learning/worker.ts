import path from "node:path";
import { readEffectiveConfig } from "../config";
import { runDeepLearning } from "../cli/deepLearn";
import { createLearningExecution, detectEngine, type EngineId, type EngineRunner, type LearningExecution } from "../engine";
import { ingestSources, openEventIndex } from "../index";
import { acquireLocalLock } from "../localFiles/lock";
import { projectPaths, type ProjectPaths } from "../paths";
import { deriveSignals, type GitRemoteReader } from "../signal";
import { updateSkillLibrary, type SkillUpdateSummary } from "../skillMaintenance";
import { episodeId, learningInterval, readLearningState, selectLearningEpisodes, selectRequestedLearningEpisodes, writeLearningState } from "./state";

type LearningOptions = {
  readonly paths?: ProjectPaths;
  readonly managedConfigPath?: string | null;
  readonly now?: number;
  readonly runner?: EngineRunner;
  readonly engine?: EngineId;
  readonly readRemote?: GitRemoteReader;
  readonly reportSkills?: (summary: SkillUpdateSummary) => void;
  readonly execution?: LearningExecution;
  readonly sessionKeys?: readonly string[];
};
type LearningStatus = "disabled" | "busy" | "deferred" | "completed" | "failed";

export function runAutomaticLearning(options: LearningOptions = {}): Promise<LearningStatus> {
  return runLearningMaintenance({ ...options, automatic: true });
}

export async function runLearningMaintenance(options: LearningOptions & { readonly automatic: boolean }): Promise<LearningStatus> {
  const paths = options.paths ?? projectPaths;
  const effective = await readEffectiveConfig({ configPath: paths.configFile, managedConfigPath: options.managedConfigPath === undefined ? paths.managedConfigFile : options.managedConfigPath });
  if (!effective.config.distillation.deep || (options.automatic && !effective.config.distillation.automatic) || effective.policy.distillation !== "allowed") return "disabled";
  const lock = await acquireLocalLock(path.join(paths.shadowcloneDirectory, "learning-worker.db"));
  if (!lock) return "busy";
  try {
    const now = options.now ?? Date.now();
    const state = await readLearningState(paths);
    if (options.automatic && !options.sessionKeys?.length && state.lastAttemptAt !== null && now - state.lastAttemptAt < learningInterval) return "deferred";
    let attempt = { ...state, lastAttemptAt: now, status: "running" as const };
    await writeLearningState({ paths, state: attempt });
    try {
      const index = await openEventIndex(paths.indexDatabase);
      try {
        await ingestSources({ index, config: effective.config, paths });
        const derived = await deriveSignals({ events: index.listEvents(), corpus: index.getCorpusSummary(), gitMetadataEnabled: effective.config.sources["git-metadata"], blockedOrigins: effective.policy.blockedOrigins, readRemote: options.readRemote });
        const requestedSessions = new Set(options.sessionKeys ?? []);
        const signals = requestedSessions.size === 0
          ? selectLearningEpisodes({ signals: derived.learning, state, now })
          : selectRequestedLearningEpisodes({
              signals: derived.learning,
              sessionKeys: requestedSessions,
              state,
            });
        if (signals.length > 0 || effective.config.sources["skill-library"]) {
          const detection = options.runner ? null : await detectEngine({ purpose: "distill", allowedEngines: effective.policy.allowedEngines });
          const runner = options.runner ?? detection?.runner;
          const engine = options.engine ?? detection?.selectedEngine;
          if (!runner || !engine) throw new Error("No authenticated learning engine is available");
          const execution = options.execution ?? createLearningExecution({ engine, runner });
          if (signals.length > 0) await runDeepLearning({ paths, policy: effective.policy, events: derived.events, signals, engine, runner, execution, dryRun: false, apply: true, writeLine: ignoreLearningOutput });
          attempt = { ...attempt, processed: [...state.processed, ...signals.map((signal) => ({ id: episodeId(signal), timestamp: signal.timestamp }))] };
          await writeLearningState({ paths, state: attempt });
          if (effective.config.sources["skill-library"]) {
            const summary = await updateSkillLibrary({ paths, execution, managedConfigPath: options.managedConfigPath, readRemote: options.readRemote });
            options.reportSkills?.(summary);
          }
        }
        await writeLearningState({ paths, state: {
          ...attempt, status: "completed", lastCompletedAt: now,
        } });
        return "completed";
      } finally { index.close(); }
    } catch {
      await writeLearningState({ paths, state: { ...attempt, status: "failed" } });
      return "failed";
    }
  } finally { lock.release(); }
}

function ignoreLearningOutput(): undefined { return undefined; }
