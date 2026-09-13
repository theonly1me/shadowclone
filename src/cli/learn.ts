import { readEffectiveConfig } from "../config";
import { allowlistedSignals } from "../distill";
import type {
  EngineId,
  EngineRunner,
  ReasoningEffort,
} from "../engine";
import { ingestSources, openEventIndex } from "../index";
import {
  episodeId,
  readLearningState,
  writeLearningState,
} from "../learning";
import { projectPaths, type ProjectPaths } from "../paths";
import { renderMirror } from "../profile";
import { checkMarkerStaleness, deriveSignals, type GitRemoteReader } from "../signal";
import type { ConfirmPrompt } from "./confirm";
import { updateSkillLibrary } from "../skillMaintenance";
import { runDeepLearning } from "./deepLearn";
import { initialize } from "./init";
import { selectManualLearningWindow } from "./learningWindow";
import { offerNativeUpgrade } from "./nativeUpgrade";

export async function learn(options: {
  readonly configPath?: string;
  readonly databasePath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly deep?: boolean;
  readonly dryRun?: boolean;
  readonly apply?: boolean;
  readonly runner?: EngineRunner;
  readonly engine?: EngineId;
  readonly model?: string;
  readonly reasoningEffort?: ReasoningEffort;
  readonly maximumCalls?: number;
  readonly confirm?: ConfirmPrompt;
  readonly writeLine?: (line: string) => void;
  readonly managedConfigPath?: string | null;
} = {}): Promise<void> {
  if (options.apply && !options.deep) {
    throw new Error("learn --apply requires --deep");
  }
  if (options.apply && options.dryRun) {
    throw new Error("learn --apply cannot be combined with --dry-run");
  }
  const paths = options.paths ?? projectPaths;
  const configPath = options.configPath ?? paths.configFile;
  const writeLine = options.writeLine ?? console.log;
  if (!(await Bun.file(configPath).exists())) {
    if (!process.stdin.isTTY) {
      throw new Error("No configuration found. Run shadowclone init interactively first.");
    }
    writeLine("No configuration found. Running shadowclone init...");
    await initialize({ configPath: options.configPath });
  }
  const { config, policy } = await readEffectiveConfig({
    configPath,
    managedConfigPath: options.managedConfigPath === undefined
      ? paths.managedConfigFile
      : options.managedConfigPath,
  });
  if (!policy.enabled) {
    throw new Error("Shadowclone is disabled by managed policy");
  }
  if (process.stdin.isTTY && process.env.SHADOWCLONE_INTERNAL_RUN !== "1") {
    await offerNativeUpgrade({ paths });
  }
  const databasePath = options.databasePath ??
    (options.dryRun ? ":memory:" : paths.indexDatabase);
  const index = await openEventIndex(databasePath);
  try {
    const summary = await ingestSources({ index, config, paths });
    const events = index.listEvents();
    const derived = await deriveSignals({
      events,
      corpus: index.getCorpusSummary(),
      gitMetadataEnabled: config.sources["git-metadata"],
      readRemote: options.readRemote,
      blockedOrigins: policy.blockedOrigins,
    });
    for (const warning of checkMarkerStaleness(events)) {
      console.warn(`Warning: ${warning}`);
    }
    const eligibleSignals = allowlistedSignals({
      signals: derived.learning,
      events: derived.events,
    }).filter((signal) => signal.textRefs.length > 0);
    const learningState = await readLearningState(paths);
    const learningWindow = selectManualLearningWindow({
      signals: eligibleSignals,
      state: learningState,
      now: Date.now(),
      ...(options.maximumCalls === undefined
        ? {}
        : { maximumCalls: options.maximumCalls }),
    });
    const { batches, signals: learningSignals } = learningWindow;
    const deepLearningPreview = {
      eligibleSteeringEpisodes: learningSignals.length,
      extractionBatches: batches.length,
    };
    let networkCallsMade = false;
    let deepChangesProposed = 0;
    let profileUpdated = false;
    if (options.deep) {
      if (!config.distillation.deep) {
        throw new Error("Deep distillation is disabled in config");
      }
      const batchLabel = batches.length === 1 ? "batch" : "batches";
      writeLine(`Deep learning found ${batches.length} reconciliation ${batchLabel}.`);
      const result = await runDeepLearning({
        signals: learningSignals,
        events: derived.events,
        paths,
        policy,
        dryRun: options.dryRun ?? false,
        apply: options.apply ?? false,
        ...(options.runner ? { runner: options.runner } : {}),
        ...(options.engine ? { engine: options.engine } : {}),
        ...(options.model ? { model: options.model } : {}),
        ...(options.reasoningEffort
          ? { reasoningEffort: options.reasoningEffort }
          : {}),
        ...(options.maximumCalls === undefined
          ? {}
          : { maximumCalls: options.maximumCalls }),
        ...(options.confirm ? { confirm: options.confirm } : {}),
        writeLine,
      });
      networkCallsMade = result.networkCallsMade;
      deepChangesProposed = result.changesProposed;
      profileUpdated = result.profileUpdated;
      if (!options.dryRun && learningSignals.length > 0) {
        await writeLearningState({
          paths,
          state: {
            ...learningState,
            processed: [
              ...learningState.processed,
              ...learningSignals.map((signal) => ({
                id: episodeId(signal),
                timestamp: signal.timestamp,
              })),
            ],
          },
        });
      }
      if (!options.dryRun && config.sources["skill-library"]) {
        const skills = await updateSkillLibrary({
          paths,
          execution: result.execution,
          managedConfigPath: options.managedConfigPath,
          readRemote: options.readRemote,
        });
        writeLine(`Skill maintenance: ${skills.synced} synced, ${skills.applied} updated, ${skills.pending} pending, ${skills.conflicts} conflicts.`);
      }
    }
    writeLine(renderMirror({
      report: derived.report,
      deepLearningPreview,
      networkCallsMade,
      ...(options.deep ? { deepChangesProposed } : {}),
      profileUpdated,
    }));
    const processedIds = new Set(
      learningState.processed.map((entry) => entry.id),
    );
    const remaining = eligibleSignals.filter((signal) =>
      !processedIds.has(episodeId(signal))
    ).length - learningSignals.length;
    if (remaining > 0) {
      writeLine(
        `\n  Deep learning covered ${learningSignals.length} episode(s); ${remaining} remain. Run shadowclone learn --deep again to continue.`,
      );
    }
    if (summary.rescannedFiles > 0) {
      writeLine(`\n  Rescanned ${summary.rescannedFiles} rewritten files.`);
    }
    if (summary.invalidRecords > 0) {
      const label = summary.invalidRecords === 1 ? "record" : "records";
      writeLine(
        `\n  Skipped ${summary.invalidRecords} invalid transcript ${label}.`,
      );
    }
  } finally {
    index.close();
  }
}
