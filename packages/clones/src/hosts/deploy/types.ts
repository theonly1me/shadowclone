import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProcessResult, Processes } from "../../run/processes";
import type { SessionConfig } from "../../session/config";
import { githubTokenSecret, providerLogins } from "../../session/providers";

export type SecretStep = {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
};

export type DeployOutcome =
  | { readonly kind: "needs-tool"; readonly detail: string }
  | { readonly kind: "needs-login"; readonly command: string }
  | {
      readonly kind: "deployed";
      readonly url: string;
      readonly directory: string;
      readonly secrets: readonly SecretStep[];
      readonly secretPlace: string;
      readonly afterSecrets: readonly string[];
    };

export type DeployContext = {
  readonly config: SessionConfig;
  readonly processes: Processes;
  readonly directory: string;
  readonly bundle: string;
  readonly webhookSecret: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly supabaseProject?: string;
  readonly denoOrganization?: string;
};

export function forwardedSecrets(config: SessionConfig): readonly string[] {
  const secret = providerLogins[config.provider].secret;

  return [githubTokenSecret, ...(secret === null ? [] : [secret])];
}

const hostKeys: Readonly<Partial<Record<SessionConfig["host"], SecretStep>>> = {
  daytona: { name: "DAYTONA_API_KEY", description: "a Daytona API key", required: true },
  e2b: { name: "E2B_API_KEY", description: "an E2B API key", required: true },
};

export function receiverSecretSteps(config: SessionConfig): readonly SecretStep[] {
  const login = providerLogins[config.provider];
  const hostKey = hostKeys[config.host];

  return [
    {
      name: githubTokenSecret,
      description: `a fine-grained token for ${config.repository} and ${config.skillsRepository}`,
      required: true,
    },
    ...(login.secret === null
      ? []
      : [{ name: login.secret, description: login.label, required: login.secretRequired }]),
    ...(hostKey === undefined ? [] : [hostKey]),
  ];
}

export async function writeProject(options: {
  readonly directory: string;
  readonly files: Readonly<Record<string, string>>;
}): Promise<void> {
  for (const [name, content] of Object.entries(options.files)) {
    const file = path.join(options.directory, name);

    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, content, { mode: 0o600 });
  }
}

export async function runIn(options: {
  readonly context: DeployContext;
  readonly command: readonly string[];
  readonly input?: string;
}): Promise<ProcessResult> {
  return options.context.processes.run({
    arguments: options.command,
    cwd: options.context.directory,
    ...(options.input === undefined ? {} : { input: options.input }),
  });
}

export function failure(options: { readonly step: string; readonly result: ProcessResult }): Error {
  const detail = `${options.result.stderr}\n${options.result.stdout}`
    .trim()
    .split("\n")
    .slice(-5)
    .join("\n");

  return new Error(`${options.step} failed with exit code ${options.result.exitCode}:\n${detail}`);
}
