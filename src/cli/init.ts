import {
  defaultConfig,
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
  const config = setSourceEnabled({
    config: defaultConfig,
    source: "claude-code",
    enabled: enableClaudeCode,
  });

  await writeConfig({ config, configPath: options.configPath });
  console.log(
    enableClaudeCode
      ? "Claude Code transcript learning enabled."
      : "All capture sources remain disabled.",
  );
}
