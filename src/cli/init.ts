import {
  defaultConfig,
  setDeepEnabled,
  setSourceEnabled,
  type SourceId,
  writeConfig,
} from "../config";

export type ConsentPrompt = (question: string) => boolean | Promise<boolean>;

const captureSources: readonly {
  readonly id: SourceId;
  readonly question: string;
}[] = [
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
  readonly ask?: ConsentPrompt;
} = {}): Promise<void> {
  await writeConfig({
    config: defaultConfig,
    configPath: options.configPath,
  });

  const ask = options.ask ?? promptForConsent;
  let config = defaultConfig;
  let captureEnabled = false;
  for (const source of captureSources) {
    const enabled = await ask(source.question);
    config = setSourceEnabled({ config, source: source.id, enabled });
    captureEnabled = captureEnabled || enabled;
  }
  const enableGitMetadata = await ask(
    "Enable reading git remote origins for organization-scoped profiles?",
  );
  const enableDeep = await ask(
    "Enable semantic distillation through your authenticated agent CLI?",
  );
  const scopedConfig = setSourceEnabled({
    config,
    source: "git-metadata",
    enabled: enableGitMetadata,
  });
  const completeConfig = setDeepEnabled({
    config: scopedConfig,
    enabled: enableDeep,
  });

  await writeConfig({ config: completeConfig, configPath: options.configPath });
  console.log(
    captureEnabled || enableGitMetadata || enableDeep
      ? "Selected sources and capabilities enabled."
      : "All capture sources remain disabled.",
  );
}
