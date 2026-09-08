import {
  defaultConfig,
  setDeepEnabled,
  setSourceEnabled,
  writeConfig,
} from "../config";
import { projectPaths, type ProjectPaths } from "../paths";
import type { SeedSkillLibrary } from "../skills";
import {
  detectOnboardingPresence,
  type OnboardingCaptureSourceId,
  type OnboardingPresence,
} from "./onboardingPresence";
import { runWizard, type WizardAnswerPrompt } from "./wizard";

export type ConsentPrompt = (question: string) => boolean | Promise<boolean>;

const captureSources: readonly {
  readonly id: OnboardingCaptureSourceId;
  readonly question: string;
}[] = [
  { id: "antigravity", question: "Enable Antigravity CLI transcripts?" },
  { id: "claude-code", question: "Enable Claude Code transcripts?" },
  { id: "claude-prompts", question: "Enable Claude prompt history?" },
  { id: "codex", question: "Enable Codex transcripts?" },
  { id: "cursor", question: "Enable Cursor CLI chat stores?" },
  { id: "shell", question: "Enable shell history?" },
];

function promptForConsent(question: string): boolean {
  const answer = prompt(`${question} [y/N]`);
  return answer?.trim().toLowerCase() === "y";
}

export async function initialize(options: {
  readonly configPath?: string;
  readonly paths?: ProjectPaths;
  readonly workingDirectory?: string;
  readonly presence?: OnboardingPresence;
  readonly library?: SeedSkillLibrary;
  readonly answer?: WizardAnswerPrompt;
  readonly ask?: ConsentPrompt;
  readonly writeLine?: (line: string) => void;
} = {}): Promise<void> {
  const paths = options.paths ?? projectPaths;
  const configPath = options.configPath ?? paths.configFile;
  const presence = options.presence ?? await detectOnboardingPresence({
    paths,
    workingDirectory: options.workingDirectory ?? process.cwd(),
  });
  const ask = options.ask ?? promptForConsent;
  const writeLine = options.writeLine ?? ((line) => console.log(line));

  if (presence.hasRulesFile) {
    writeLine("Existing agent instructions detected and left unread.");
  } else {
    await runWizard({
      paths,
      library: options.library,
      answer: options.answer,
      confirm: ask,
      writeLine,
    });
  }

  let config = defaultConfig;
  let captureEnabled = false;
  for (const source of captureSources) {
    if (!presence.presentCaptureSources.has(source.id)) {
      continue;
    }
    const enabled = await ask(source.question);
    config = setSourceEnabled({ config, source: source.id, enabled });
    captureEnabled = captureEnabled || enabled;
  }
  const enableGitMetadata = await ask(
    "Enable reading git remote origins for organization-scoped profiles?",
  );
  const enableAgentContext = await ask(
    "Enable reading agent instructions, skills and native memory for frozen eval baselines?",
  );
  const enableDeep = await ask(
    "Enable semantic distillation through your authenticated agent CLI?",
  );
  config = setSourceEnabled({
    config,
    source: "git-metadata",
    enabled: enableGitMetadata,
  });
  config = setSourceEnabled({
    config,
    source: "agent-context",
    enabled: enableAgentContext,
  });
  config = setDeepEnabled({ config, enabled: enableDeep });

  await writeConfig({ config, configPath });
  writeLine(
    captureEnabled || enableGitMetadata || enableAgentContext || enableDeep
      ? "Selected sources and capabilities enabled."
      : "All capture sources remain disabled.",
  );
  if (captureEnabled) {
    writeLine(
      "Run shadowclone learn to build evidence from the sources you enabled.",
    );
  }
}
