import {
  defaultConfig,
  applyManagedPolicy,
  readManagedPolicy,
  setDeepEnabled,
  setSourceEnabled,
  writeConfig,
} from "../config";
import type { ManagedPolicy } from "../config";
import type { EngineId, EngineRunner } from "../engine";
import { importRepositoryGuidance } from "../importRules";
import type { IntegrationAgent } from "../integrations";
import { projectPaths, type ProjectPaths } from "../paths";
import { configureSkillMaintenance, updateSkillLibrary } from "../skillMaintenance";
import { initializeAdvanced, type ConsentPrompt, type InitializeAdvancedOptions } from "./initAdvanced";
import { detectPersonalSkills, detectedAgentNames, detectedIntegrationAgents, printDetectionSummary } from "./initDetection";
import { createSetupEngine, runSetupLearning } from "./initLearning";
import { installNativeCommand } from "./native";
import { detectOnboardingPresence, type OnboardingPresence } from "./onboardingPresence";

export type { ConsentPrompt } from "./initAdvanced";

export function answerIsYes(answer: string | null): boolean {
  if (answer === null) return false;
  const normalized = answer.trim().toLowerCase();
  return normalized === "" || normalized === "y" || normalized === "yes";
}

function promptForConsent(question: string): boolean {
  return answerIsYes(prompt(question));
}

export type InitializeOptions = InitializeAdvancedOptions & {
  readonly advanced?: boolean;
  readonly agents?: readonly IntegrationAgent[];
  readonly install?: typeof installNativeCommand;
  readonly runner?: EngineRunner;
  readonly engine?: EngineId;
  readonly now?: number;
};

export async function initialize(options: InitializeOptions = {}): Promise<void> {
  if (options.advanced) {
    await initializeAdvanced(options);
    return;
  }
  const paths: ProjectPaths = options.paths ?? projectPaths;
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const configPath = options.configPath ?? paths.configFile;
  const presence: OnboardingPresence = options.presence ?? await detectOnboardingPresence({
    paths,
    workingDirectory,
  });
  const agents = options.agents ?? await detectedIntegrationAgents(paths);
  const personalSkillsPresent = await detectPersonalSkills(paths);
  const ask: ConsentPrompt = options.ask ?? promptForConsent;
  const writeLine = options.writeLine ?? console.log;
  const policy: ManagedPolicy = options.managedPolicy ?? await readManagedPolicy(
    options.managedConfigPath === undefined
      ? paths.managedConfigFile
      : options.managedConfigPath,
  );

  printDetectionSummary({ paths, presence, agents, personalSkillsPresent, writeLine });
  const learn = await ask("Learn how you work from these sessions? [Y/n]");
  const skillPrompt = agents.length > 0
    ? `Keep your skills in sync across ${detectedAgentNames(agents)}? [Y/n]`
    : "Keep your skills in sync across your agents? [Y/n]";
  const skills = await ask(skillPrompt);
  const background = await ask("Keep improving in the background as you work? [Y/n]");

  let config = defaultConfig;
  if (learn) {
    for (const source of presence.presentCaptureSources) {
      config = setSourceEnabled({ config, source, enabled: true });
    }
    config = setSourceEnabled({ config, source: "git-metadata", enabled: true });
    config = setSourceEnabled({ config, source: "agent-context", enabled: true });
    config = setSourceEnabled({
      config,
      source: "declared-rules",
      enabled: presence.hasRepositoryGuidance,
    });
  }
  config = setSourceEnabled({ config, source: "skill-library", enabled: skills });
  config = setDeepEnabled({ config, enabled: background });
  config = {
    ...config,
    distillation: { ...config.distillation, automatic: background },
  };
  await writeConfig({ config, configPath });

  let rulesLearned = 0;
  if (learn && presence.hasRepositoryGuidance && policy.enabled && policy.allowedSources.includes("declared-rules")) {
    const imported = await importRepositoryGuidance({
      paths,
      workingDirectory,
      gitMetadataEnabled: policy.allowedSources.includes("git-metadata"),
      blockedOrigins: policy.blockedOrigins,
      readRemote: options.readRemote,
    });
    rulesLearned += imported.imported;
  }

  let skillsSynced = 0;
  if (skills && policy.enabled && policy.allowedSources.includes("skill-library")) {
    await configureSkillMaintenance({
      scope: "global",
      paths,
      cwd: workingDirectory,
      managedConfigPath: options.managedConfigPath,
    });
    const updated = await updateSkillLibrary({
      paths,
      syncPersonal: true,
      managedConfigPath: options.managedConfigPath,
      readRemote: options.readRemote,
    });
    skillsSynced = updated.synced;
    if (updated.conflicts > 0) {
      writeLine(`${updated.conflicts} skill conflicts need review.`);
    }
  }
  const deepAllowed = background && policy.enabled && policy.distillation === "allowed";
  const setupEngine = deepAllowed
    ? await createSetupEngine({ policy, engine: options.engine, runner: options.runner })
    : null;
  if (deepAllowed && learn && setupEngine) {
    try {
      rulesLearned += await runSetupLearning({
        paths,
        config: applyManagedPolicy({ config, policy }),
        policy,
        setupEngine,
        now: options.now ?? Date.now(),
        readRemote: options.readRemote,
        writeLine,
      });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message === "Learning deadline reached") {
        writeLine("Learning reached its time budget; background learning will continue.");
      } else if (error.message === "Learning call limit reached" || error.message === "Learning cost limit reached") {
        writeLine("Learning reached its setup budget; background learning will continue.");
      } else {
        throw error;
      }
    }
  } else if (deepAllowed) {
    writeLine("No authenticated agent CLI is available for the first learning pass.");
  }
  if (agents.length > 0) {
    await (options.install ?? installNativeCommand)({
      agents,
      scope: "global",
      subagent: false,
      autoDelegate: false,
    });
  }
  writeLine(`${skillsSynced} skills synced; ${rulesLearned} rules learned; ${agents.length} agents installed.`);
  writeLine("Your next agent session will use the profile.");
}
