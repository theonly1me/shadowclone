import path from "node:path";
import { receiverBundle } from "../hosts/bundle" with { type: "macro" };
import { deployCloudHost } from "../hosts/deploy";
import type { SecretStep } from "../hosts/deploy/types";
import { registerWebhook, webhookSecret } from "../hosts/webhook";
import type { GithubCall } from "../github";
import type { Processes } from "../run/processes";
import type { SessionConfig } from "../session/config";
import { saveSessionConfig, type ClonesPaths } from "../session/store";

export type CloudSetupOutcome =
  | { readonly kind: "needs-host-tool"; readonly detail: string }
  | { readonly kind: "needs-host-login"; readonly command: string }
  | {
      readonly kind: "configured-cloud";
      readonly config: SessionConfig;
      readonly url: string;
      readonly secrets: readonly SecretStep[];
      readonly secretPlace: string;
      readonly afterSecrets: readonly string[];
      readonly sandboxStep: string | null;
      readonly directory: string;
    };

export function hostDirectory(options: {
  readonly paths: ClonesPaths;
  readonly config: SessionConfig;
}): string {
  return path.join(
    options.paths.directory,
    "hosts",
    options.config.repository.replace("/", "__"),
    options.config.receiver ?? options.config.host,
  );
}

export async function setUpCloudHost(options: {
  readonly config: SessionConfig;
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly paths: ClonesPaths;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly supabaseProject?: string;
  readonly denoOrganization?: string;
}): Promise<CloudSetupOutcome> {
  const secret = webhookSecret();
  const directory = hostDirectory(options);
  const deployment = await deployCloudHost({
    config: options.config,
    processes: options.processes,
    directory,
    bundle: receiverBundle(),
    webhookSecret: secret,
    environment: options.environment,
    ...(options.supabaseProject === undefined ? {} : { supabaseProject: options.supabaseProject }),
    ...(options.denoOrganization === undefined
      ? {}
      : { denoOrganization: options.denoOrganization }),
  });
  const { receiver } = deployment;

  if (receiver.kind === "needs-tool") {
    return { kind: "needs-host-tool", detail: receiver.detail };
  }

  if (receiver.kind === "needs-login") {
    return { kind: "needs-host-login", command: receiver.command };
  }

  await registerWebhook({
    github: options.github,
    repository: options.config.repository,
    url: receiver.url,
    secret,
  });

  const config = { ...options.config, receiverUrl: receiver.url };

  await saveSessionConfig({ paths: options.paths, config });

  return {
    kind: "configured-cloud",
    config,
    url: receiver.url,
    secrets: receiver.secrets,
    secretPlace: receiver.secretPlace,
    afterSecrets: receiver.afterSecrets,
    sandboxStep: deployment.sandbox.kind === "manual" ? deployment.sandbox.step : null,
    directory,
  };
}
