import { readEffectiveConfig } from "../config";
import { allowlistedSignals, groupDistillBatches } from "../distill";
import type { EngineId, EngineRunner } from "../engine";
import { ingestSources, openEventIndex } from "../index";
import { projectPaths, type ProjectPaths } from "../paths";
import { renderMirror } from "../profile";
import { checkMarkerStaleness, deriveSignals, type GitRemoteReader } from "../signal";
import type { ConfirmPrompt } from "./confirm";
import { runDeepLearning } from "./deepLearn";
import { initialize } from "./init";

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
    configPath: options.configPath,
    managedConfigPath: options.managedConfigPath === undefined
      ? paths.managedConfigFile
      : options.managedConfigPath,
  });
  if (!policy.enabled) {
    throw new Error("Shadowclone is disabled by managed policy");
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
      bindings: index,
    });
    for (const warning of checkMarkerStaleness(events)) {
      console.warn(`Warning: ${warning}`);
    }
    const eligibleSignals = allowlistedSignals({
      signals: derived.corrections,
      events: derived.events,
    }).filter((signal) => signal.textRefs.length > 0);
    const batches = groupDistillBatches({ signals: eligibleSignals });
    const deepLearningPreview = {
      eligibleCorrectionMoments: eligibleSignals.length,
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
      if (batches.length > 0) {
        const result = await runDeepLearning({
          signals: eligibleSignals,
          events: derived.events,
          paths,
          policy,
          dryRun: options.dryRun ?? false,
          apply: options.apply ?? false,
          ...(options.runner ? { runner: options.runner } : {}),
          ...(options.engine ? { engine: options.engine } : {}),
          ...(options.confirm ? { confirm: options.confirm } : {}),
          writeLine,
        });
        networkCallsMade = result.networkCallsMade;
        deepChangesProposed = result.changesProposed;
        profileUpdated = result.profileUpdated;
      }
    }
    writeLine(renderMirror({
      report: derived.report,
      deepLearningPreview,
      networkCallsMade,
      ...(options.deep ? { deepChangesProposed } : {}),
      profileUpdated,
    }));
    if (summary.omittedRecords > 0) {
      writeLine(`Skipped ${summary.omittedRecords} oversized transcript records.`);
    }
    if (summary.rescannedFiles > 0) {
      writeLine(`\n  Rescanned ${summary.rescannedFiles} rewritten files.`);
    }
  } finally {
    index.close();
  }
}
