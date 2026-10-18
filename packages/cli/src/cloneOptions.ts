import {
  checkCloneHost,
  cloneProviders,
  clonesPaths,
  hostProcesses,
  readCloneConfig,
  secretLines,
} from "@shadowclone/clones";
import { setUpClonesInTerminal } from "./cloneSetup";

export const cloneSetupUsage =
  "clone setup [--repo owner/repository] [--provider claude-subscription|anthropic|chatgpt-subscription|openai|openai-compatible|ollama|foundry] [--base-url url] [--model id] [--image name] [--no-attribution] [--yes]";

export function flagValue(options: {
  readonly arguments: readonly string[];
  readonly flag: string;
}): string | null {
  const index = options.arguments.indexOf(options.flag);

  return index < 0 ? null : (options.arguments[index + 1] ?? "");
}

export async function configuredRepository(arguments_: readonly string[]) {
  const repository = flagValue({ arguments: arguments_, flag: "--repo" });
  const config =
    repository === null ? null : await readCloneConfig({ paths: clonesPaths(), repository });

  if (config === null) {
    throw new Error(
      "Name a repository that has clones on this machine with --repo owner/repository.",
    );
  }

  return config;
}

export async function setupCommand(arguments_: readonly string[]): Promise<void> {
  const value = (flag: string) => flagValue({ arguments: arguments_, flag });
  const provider = cloneProviders.find(
    (entry) => entry === (value("--provider") ?? "claude-subscription"),
  );
  const baseUrl = value("--base-url");
  const model = value("--model");
  const image = value("--image");

  if (provider === undefined) {
    throw new Error(`Use shadowclone ${cloneSetupUsage}.`);
  }

  await setUpClonesInTerminal({
    repository: value("--repo"),
    provider,
    ...(baseUrl === null ? {} : { baseUrl }),
    ...(model === null ? {} : { model }),
    ...(image === null ? {} : { image }),
    attribution: !arguments_.includes("--no-attribution"),
    yes: arguments_.includes("--yes"),
  });
}

export async function statusCommand(arguments_: readonly string[]): Promise<void> {
  const config = await configuredRepository(arguments_);
  const lines = await checkCloneHost({ config, paths: clonesPaths(), processes: hostProcesses });

  for (const line of lines) {
    console.log(`${line.passed ? "pass" : "fail"} ${line.name}: ${line.detail}`);
  }

  process.exitCode = lines.every((line) => line.passed) ? 0 : 1;
}

export async function secretsCommand(arguments_: readonly string[]): Promise<void> {
  const config = await configuredRepository(arguments_);
  const lines = secretLines(config).map(
    (line) => `  ${line.name}: ${line.description}${line.required ? "" : " (optional)"}`,
  );

  console.log(
    [`Paste these values into ${clonesPaths().secretsFile} in an editor:`, ...lines].join("\n"),
  );
}
