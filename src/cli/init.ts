import { initialConfiguration } from "./initConfiguration";
import { prepareInitialEnvironment } from "./initEnvironment";
import { applyManagedPolicy, readManagedPolicy, writeConfig } from "../config";
import type { ManagedPolicy } from "../config";
import type { EngineId, EngineRunner } from "../engine";
import type { IntegrationAgent } from "../integrations";
import { projectPaths, type ProjectPaths } from "../paths";
import {
  initializeAdvanced,
  type ConsentPrompt,
  type InitializeAdvancedOptions,
} from "./initAdvanced";
import {
  detectPersonalSkills,
  detectedAgentNames,
  detectedIntegrationAgents,
  printDetectionSummary,
} from "./initDetection";
import { createSetupEngine, runSetupLearning } from "./initLearning";
import { installNativeCommand } from "./native";
import {
  detectOnboardingPresence,
  type OnboardingPresence,
} from "./onboardingPresence";
import type { InitializeConsent } from "./initOptions";

export type { ConsentPrompt } from "./initAdvanced";

export function answerIsYes(answer: string | null): boolean {
  if (answer === null) {
    return false;
  }

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
  readonly consent?: InitializeConsent;
};

export async function initialize(
  options: InitializeOptions = {},
): Promise<void> {
  if (options.advanced) {
    await initializeAdvanced(options);

    return;
  }

  const paths: ProjectPaths = options.paths ?? projectPaths;
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const configPath = options.configPath ?? paths.configFile;

  const presence: OnboardingPresence =
    options.presence ??
    (await detectOnboardingPresence({
      paths,
      workingDirectory,
    }));
  const agents = options.agents ?? (await detectedIntegrationAgents(paths));
  const personalSkillsPresent = await detectPersonalSkills(paths);

  const ask: ConsentPrompt = options.ask ?? promptForConsent;
  const writeLine = options.writeLine ?? console.log;
  const policy: ManagedPolicy =
    options.managedPolicy ??
    (await readManagedPolicy(
      options.managedConfigPath === undefined
        ? paths.managedConfigFile
        : options.managedConfigPath,
    ));

  printDetectionSummary({
    paths,
    presence,
    agents,
    personalSkillsPresent,
    writeLine,
  });

  const learn =
    options.consent?.learn ??
    (await ask("Learn how you work from these sessions? [Y/n]"));
  const skillPrompt =
    agents.length > 0
      ? `Keep your skills in sync and automatically maintain them across ${detectedAgentNames(agents)}? [Y/n]`
      : "Keep your skills in sync and automatically maintain them across your agents? [Y/n]";
  const skills = options.consent?.skills ?? (await ask(skillPrompt));
  const background =
    options.consent?.background ??
    (await ask("Keep improving in the background as you work? [Y/n]"));

  if (background && !learn) {
    throw new Error("Background learning requires session learning");
  }

  const config = initialConfiguration({ learn, skills, background, presence });

  await writeConfig({ config, configPath });

  const environment = await prepareInitialEnvironment({
    ...options,
    paths,
    workingDirectory,
    policy,
    learn,
    skills,
    presence,
    writeLine,
  });
  let rulesLearned = environment.rulesLearned;
  const skillsSynced = environment.skillsSynced;

  const deepAllowed =
    background && policy.enabled && policy.distillation === "allowed";
  const setupEngine = deepAllowed
    ? await createSetupEngine({
        policy,
        engine: options.engine,
        runner: options.runner,
      })
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
      if (!(error instanceof Error)) {
        throw error;
      }

      if (error.message === "Learning deadline reached") {
        writeLine(
          "Learning reached its time budget; background learning will continue.",
        );
      } else if (
        error.message === "Learning call limit reached" ||
        error.message === "Learning cost limit reached"
      ) {
        writeLine(
          "Learning reached its setup budget; background learning will continue.",
        );
      } else {
        throw error;
      }
    }
  } else if (deepAllowed) {
    writeLine(
      "No authenticated agent CLI is available for the first learning pass.",
    );
  }

  if (agents.length > 0) {
    await (options.install ?? installNativeCommand)({
      agents,
      scope: "global",
      subagent: false,
      autoDelegate: false,
    });
  }

  writeLine(
    `${skillsSynced} skills synced; ${rulesLearned} rules learned; ${agents.length} agents installed.`,
  );
  writeLine(
    "Your next agent session will use its native instructions and learned skills.",
  );
}
