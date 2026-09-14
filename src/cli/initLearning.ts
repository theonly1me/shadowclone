import type { ManagedPolicy, ShadowcloneConfig } from "../config";
import { allowlistedSignals, distillConcurrency } from "../distill";
import {
  createLearningExecution,
  detectEngine,
  setupLearningLimits,
  type EngineId,
  type EngineRunner,
  type LearningExecution,
} from "../engine";
import { ingestSources, openEventIndex } from "../index";
import {
  episodeId,
  readLearningState,
  selectNewestLearningEpisodes,
  writeLearningState,
} from "../learning";
import type { ProjectPaths } from "../paths";
import { deriveSignals, type GitRemoteReader } from "../signal";
import { runDeepLearning } from "./deepLearn";

export type SetupEngine = {
  readonly engine: EngineId;
  readonly runner: EngineRunner;
  readonly execution: LearningExecution;
};

export async function createSetupEngine(options: {
  readonly policy: ManagedPolicy;
  readonly engine?: EngineId;
  readonly runner?: EngineRunner;
}): Promise<SetupEngine | null> {
  const detected = options.runner ? null : await detectEngine({
    purpose: "distill",
    allowedEngines: options.engine
      ? [options.engine]
      : options.policy.allowedEngines,
  });
  const engine = options.engine ?? detected?.selectedEngine;
  const runner = options.runner ?? detected?.runner;
  if (!engine || !runner) return null;
  return {
    engine,
    runner,
    execution: createLearningExecution({ engine, runner, limits: setupLearningLimits }),
  };
}

export async function runSetupLearning(options: {
  readonly paths: ProjectPaths;
  readonly config: ShadowcloneConfig;
  readonly policy: ManagedPolicy;
  readonly setupEngine: SetupEngine;
  readonly now: number;
  readonly readRemote?: GitRemoteReader;
  readonly writeLine: (line: string) => void;
}): Promise<number> {
  const index = await openEventIndex(options.paths.indexDatabase);
  try {
    await ingestSources({ index, config: options.config, paths: options.paths });
    const events = index.listEvents().filter((event) => options.config.sources[event.source]);
    const derived = await deriveSignals({
      events,
      corpus: index.getCorpusSummary(),
      gitMetadataEnabled: options.config.sources["git-metadata"],
      readRemote: options.readRemote,
      blockedOrigins: options.policy.blockedOrigins,
      bindings: index,
    });
    const eligibleSignals = allowlistedSignals({
      signals: derived.learning,
      events: derived.events,
    }).filter((signal) => signal.textRefs.length > 0);
    const state = await readLearningState(options.paths);
    const signals = selectNewestLearningEpisodes({
      signals: eligibleSignals,
      state,
      now: options.now,
      limit: distillConcurrency * 20,
    });
    if (signals.length === 0) return 0;
    const result = await runDeepLearning({
      signals,
      events: derived.events,
      paths: options.paths,
      policy: options.policy,
      runner: options.setupEngine.runner,
      engine: options.setupEngine.engine,
      execution: options.setupEngine.execution,
      limits: setupLearningLimits,
      dryRun: false,
      apply: true,
      writeLine: options.writeLine,
    });
    await writeLearningState({
      paths: options.paths,
      state: {
        ...state,
        processed: [
          ...state.processed,
          ...signals.map((signal) => ({ id: episodeId(signal), timestamp: signal.timestamp })),
        ],
      },
    });
    return result.changesProposed;
  } finally {
    index.close();
  }
}
