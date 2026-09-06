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
import { initialize } from "./init";
import { installLiveClone } from "./install";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
  buildProfileRules,
  renderMirror,
  writeProfile,
} from "../profile";
import type { ProfileRule } from "../profile";
import { checkMarkerStaleness, deriveSignals } from "../signal";
import type { GitRemoteReader } from "../signal";

async function isGitWorkTree(cwd: string): Promise<boolean> {
  const child = Bun.spawn({
    cmd: ["git", "-C", cwd, "rev-parse", "--is-inside-work-tree"],
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await child.exited) === 0;
}

export async function learn(options: {
  readonly configPath?: string;
  readonly databasePath?: string;
  readonly targetDirectory?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly deep?: boolean;
  readonly dryRun?: boolean;
  readonly runner?: EngineRunner;
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
    if (options.dryRun) {
      console.log(renderMirror({ report: derived.report, networkCallsMade: false }));
      return;
    }
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
    const usesSemanticRules = options.deep && semanticRules.length > 0;
    const profileRules = usesSemanticRules ? semanticRules : structuralRules;
    const sortedRules = [...profileRules].sort(
      (left, right) =>
        right.observations - left.observations ||
        left.title.localeCompare(right.title),
    );
    await writeProfile({
      paths,
      rules: sortedRules,
      generator: usesSemanticRules ? "all" : "structural",
    });
    console.log(renderMirror({ report: derived.report, networkCallsMade }));
    if (summary.rescannedFiles > 0) {
      console.log(`\n  Rescanned ${summary.rescannedFiles} rewritten files.`);
    }

    const targetDirectory = options.targetDirectory ?? process.cwd();
    if (await isGitWorkTree(targetDirectory)) {
      try {
        await installLiveClone({
          cwd: targetDirectory,
          paths,
          readRemote: options.readRemote,
          configPath: options.configPath,
          managedConfigPath: options.managedConfigPath,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Warning: failed to install clone hook: ${message}`);
      }
    }
  } finally {
    index.close();
  }
}
