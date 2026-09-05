import { readEffectiveConfig } from "../config";
import {
  allowlistedSignals,
  distillSignals,
  groupDistillBatches,
} from "../distill";
import { detectEngine } from "../engine";
import type { EngineRunner } from "../engine";
import {
  ingestSources,
  openEventIndex,
} from "../index";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
  buildProfileRules,
  renderMirror,
  writeProfile,
} from "../profile";
import type { ProfileRule } from "../profile";
import { deriveSignals } from "../signal";
import type { GitRemoteReader } from "../signal";

export async function learn(options: {
  readonly configPath?: string;
  readonly databasePath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly deep?: boolean;
  readonly runner?: EngineRunner;
  readonly managedConfigPath?: string | null;
} = {}): Promise<void> {
  const paths = options.paths ?? projectPaths;
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
  const index = await openEventIndex(
    options.databasePath ?? paths.indexDatabase,
  );

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
    const structuralRules = buildProfileRules({
      events: derived.events,
      signals: derived.corrections,
      origins: derived.origins,
    });
    let semanticRules: readonly ProfileRule[] = [];
    let networkCallsMade = false;
    if (options.deep) {
      if (!config.distillation.deep) {
        throw new Error("Deep distillation is disabled in config");
      }
      const eligibleSignals = allowlistedSignals({
        signals: derived.corrections,
        events: derived.events,
      }).filter(
        (signal) => signal.textRefs.length > 0,
      );
      const batches = groupDistillBatches({ signals: eligibleSignals });
      console.log(
        `Deep distillation will run up to ${batches.length} agent batches.`,
      );
      if (batches.length > 0) {
        if (
          policy.distillation !== "allowed" ||
          !policy.allowedEngines.includes("claude-code")
        ) {
          throw new Error("Managed policy does not allow the Claude Code engine");
        }
        const detection = options.runner ? null : await detectEngine();
        const runner = options.runner ?? detection?.runner;
        if (!runner) {
          throw new Error("No authenticated agent engine is available");
        }
        const result = await distillSignals({
          signals: eligibleSignals,
          runner,
          workingDirectory: paths.shadowcloneDirectory,
          checkpointDirectory: paths.distillDirectory,
          events: derived.events,
        });
        semanticRules = result.rules;
        networkCallsMade = result.engineRuns > 0;
      }
    }
    await writeProfile({
      paths,
      rules: [...structuralRules, ...semanticRules],
    });
    console.log(renderMirror({ report: derived.report, networkCallsMade }));
    if (summary.rescannedFiles > 0) {
      console.log(`\n  Rescanned ${summary.rescannedFiles} rewritten files.`);
    }
  } finally {
    index.close();
  }
}
