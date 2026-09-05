import {
  defaultConfig,
  setDeepEnabled,
  setSourceEnabled,
  writeConfig,
} from "../config";

export type ConsentPrompt = (question: string) => boolean | Promise<boolean>;

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
  const enableClaudeCode = await ask(
    "Enable learning from Claude Code transcripts?",
  );
  const enableGitMetadata = await ask(
    "Enable reading git remote origins for organization-scoped profiles?",
  );
  const enableDeep = await ask(
    "Enable semantic distillation through your authenticated agent CLI?",
  );
  const transcriptConfig = setSourceEnabled({
    config: defaultConfig,
    source: "claude-code",
    enabled: enableClaudeCode,
  });
  const config = setSourceEnabled({
    config: transcriptConfig,
    source: "git-metadata",
    enabled: enableGitMetadata,
  });
  const completeConfig = setDeepEnabled({
    config,
    enabled: enableDeep,
  });

  await writeConfig({ config: completeConfig, configPath: options.configPath });
  console.log(
    enableClaudeCode || enableGitMetadata || enableDeep
      ? "Selected sources and capabilities enabled."
      : "All capture sources remain disabled.",
  );
}
