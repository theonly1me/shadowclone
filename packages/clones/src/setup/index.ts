import { ownedDirectory } from "@shadowclone/core";
import type { GithubCall } from "../github";
import type { Processes } from "../run/processes";
import type { SessionConfig } from "../session/config";
import { saveSessionConfig, type ClonesPaths } from "../session/store";
import { installService, type ServiceOutcome } from "../serve/service";
import { setUpCloudHost, type CloudSetupOutcome } from "./cloud";
import {
  organizationWarning,
  prepareSessions,
  type Preparation,
  type SetupRequest,
} from "./prepare";
import { createSecretsFile, secretLines, type SecretLine } from "./secrets";

export type LocalSetupOutcome = {
  readonly kind: "configured";
  readonly config: SessionConfig;
  readonly secretsFile: string;
  readonly secretsFileCreated: boolean;
  readonly secrets: readonly SecretLine[];
  readonly service: ServiceOutcome;
  readonly imageReady: boolean;
  readonly warnings: readonly string[];
};

export type SessionSetupOutcome =
  | { readonly kind: "needs-docker"; readonly detail: string }
  | Exclude<Preparation, { readonly kind: "ready" }>
  | LocalSetupOutcome
  | (CloudSetupOutcome & { readonly warnings?: readonly string[] });

type SetupHost = {
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly paths: ClonesPaths;
  readonly executable: string;
  readonly pathVariable: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly supabaseProject?: string;
  readonly denoOrganization?: string;
};

async function imageReady(options: {
  readonly processes: Processes;
  readonly paths: ClonesPaths;
  readonly image: string;
}): Promise<boolean> {
  const run = (command: readonly string[]) =>
    options.processes.run({ arguments: command, cwd: options.paths.directory });

  return (
    (await run(["docker", "image", "inspect", options.image])).exitCode === 0 ||
    (await run(["docker", "pull", "--quiet", options.image])).exitCode === 0
  );
}

async function setUpLocal(
  options: SetupHost & { readonly config: SessionConfig; readonly organization: boolean },
): Promise<LocalSetupOutcome> {
  const { config, paths, processes } = options;

  await saveSessionConfig({ paths, config });

  const secrets = secretLines(config);
  const created = await createSecretsFile({ paths, lines: secrets });
  const ready = await imageReady({ processes, paths, image: config.image });
  const service = await installService({
    paths,
    processes,
    executable: options.executable,
    pathVariable: options.pathVariable,
  });

  return {
    kind: "configured",
    config,
    secretsFile: paths.secretsFile,
    secretsFileCreated: created === "created",
    secrets,
    service,
    imageReady: ready,
    warnings: [
      ...(options.organization ? [organizationWarning] : []),
      ...(ready
        ? []
        : [`Docker could not pull ${config.image}. Sessions cannot start until the image exists.`]),
    ],
  };
}

export async function setUpSessions(
  options: SetupHost & SetupRequest,
): Promise<SessionSetupOutcome> {
  const { processes, paths } = options;

  await ownedDirectory(paths.directory);

  if (options.host === "local") {
    const docker = await processes.run({
      arguments: ["docker", "info", "--format", "{{.ServerVersion}}"],
      cwd: paths.directory,
    });

    if (docker.exitCode !== 0) {
      return {
        kind: "needs-docker",
        detail: docker.stderr.trim().split("\n").at(-1) ?? "docker info failed.",
      };
    }
  }

  const prepared = await prepareSessions(options);

  if (prepared.kind !== "ready") {
    return prepared;
  }

  if (prepared.config.host === "local") {
    return setUpLocal({ ...options, config: prepared.config, organization: prepared.organization });
  }

  const cloud = await setUpCloudHost({ ...options, config: prepared.config });

  return { ...cloud, warnings: prepared.organization ? [organizationWarning] : [] };
}
