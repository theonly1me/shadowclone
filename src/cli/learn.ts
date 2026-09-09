import { readEffectiveConfig } from "../config";
import {
  allowlistedSignals,
  distillSignals,
  groupDistillBatches,
} from "../distill";
import { detectEngine } from "../engine";
import {
  defaultLearningExecutionLimits,
  type EngineId,
  type EngineRunner,
} from "../engine";
import {
  ingestSources,
  openEventIndex,
} from "../index";
import { initialize } from "./init";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { getProviderByEngine } from "../provider";
import {
  renderMirror,
  writeProfile,
} from "../profile";
import type { ProfileRule } from "../profile";
import { checkMarkerStaleness, deriveSignals } from "../signal";
import type { GitRemoteReader } from "../signal";

export async function learn(options: {
  readonly configPath?: string;
  readonly databasePath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly deep?: boolean;
  readonly dryRun?: boolean;
  readonly runner?: EngineRunner;
  readonly engine?: EngineId;
  readonly managedConfigPath?: string | null;
} = {}): Promise<void> {
  const paths = options.paths ?? projectPaths;
  const configPath = options.configPath ?? paths.configFile;
  const configFile = Bun.file(configPath);

  if (!(await configFile.exists())) {
    if (!process.stdin.isTTY) {
      throw new Error("No configuration found. Run shadowclone init interactively first.");
    }
    console.log("No configuration found. Running shadowclone init...");
    await initialize({ configPath: options.configPath });
  }

  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? paths.managedConfigFile
        : options.managedConfigPath,
  });
  if (!policy.enabled) {
    throw new Error("Shadowclone is disabled by managed policy");
  }
  const dbPath =
    options.databasePath ??
    (options.dryRun ? ":memory:" : paths.indexDatabase);
  const index = await openEventIndex(dbPath);

  try {
    const summary = await ingestSources({
      index,
      config,
      paths,
    });
    const events = index.listEvents();
    const derived = await deriveSignals({
      events,
      corpus: index.getCorpusSummary(),
      gitMetadataEnabled: config.sources["git-metadata"],
      readRemote: options.readRemote,
      blockedOrigins: policy.blockedOrigins,
    });
    const markerWarnings = checkMarkerStaleness(events);
    for (const warning of markerWarnings) {
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
    if (options.dryRun || !options.deep) {
      console.log(
        renderMirror({
          report: derived.report,
          deepLearningPreview,
          networkCallsMade: false,
        }),
      );
      if (summary.rescannedFiles > 0) {
        console.log(`\n  Rescanned ${summary.rescannedFiles} rewritten files.`);
      }
      return;
    }
    let semanticRules: readonly ProfileRule[] = [];
    let networkCallsMade = false;
    if (!config.distillation.deep) {
      throw new Error("Deep distillation is disabled in config");
    }
    const batchLabel = batches.length === 1 ? "batch" : "batches";
    console.log(
      `Deep distillation found ${batches.length} extraction ${batchLabel}.`,
    );
    if (batches.length > 0) {
      if (policy.distillation !== "allowed") {
        throw new Error("Managed policy does not allow remote distillation");
      }
      const detection = options.runner
        ? null
        : await detectEngine({
            purpose: "distill",
            allowedEngines: policy.allowedEngines,
          });
      const runner = options.runner ?? detection?.runner;
      const engine = options.engine ?? detection?.selectedEngine;
      if (!runner || !engine) {
        throw new Error("No authenticated agent engine is available");
      }
      const supportsCostLimit =
        getProviderByEngine(engine)?.engine?.capabilities.maxBudgetUsd === true;
      const limits = defaultLearningExecutionLimits;
      console.log(
        [
          `Learning is limited to ${limits.maximumCalls} total calls and ${limits.timeoutMilliseconds / 1_000} seconds`,
          supportsCostLimit
            ? ` with a $${limits.maximumCostUsd.toFixed(2)} total ceiling.`
            : ".",
        ].join(""),
      );
      const result = await distillSignals({
        signals: eligibleSignals,
        runner,
        engine,
        limits,
        workingDirectory: paths.shadowcloneDirectory,
        checkpointDirectory: paths.distillDirectory,
        events: derived.events,
      });
      semanticRules = result.rules;
      networkCallsMade = result.engineRuns > 0;
    }
    if (semanticRules.length > 0) {
      const sortedRules = [...semanticRules].sort(
        (left, right) =>
          right.observations - left.observations ||
          left.title.localeCompare(right.title),
      );
      await writeProfile({ paths, rules: sortedRules });
    }
    console.log(
      renderMirror({
        report: derived.report,
        deepLearningPreview,
        networkCallsMade,
        deepRulesProduced: semanticRules.length,
      }),
    );
    if (summary.rescannedFiles > 0) {
      console.log(`\n  Rescanned ${summary.rescannedFiles} rewritten files.`);
    }
  } finally {
    index.close();
  }
}
