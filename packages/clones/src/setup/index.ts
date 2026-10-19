import { ownedDirectory } from "@shadowclone/core";
import type { GithubCall } from "../github";
import type { Processes } from "../run/processes";
import type { CloneConfig } from "../config/config";
import { saveCloneConfig, type ClonesPaths } from "../config/store";
import { cloneServeService, installService, type ServiceOutcome } from "../serve/service";
import {
  organizationWarning,
  prepareClones,
  type Preparation,
  type SetupRequest,
} from "./prepare";
import { createSecretsFile, secretLines, type SecretLine } from "./secrets";

export type LocalSetupOutcome = {
  readonly kind: "configured";
  readonly config: CloneConfig;
  readonly secretsFile: string;
  readonly secretsFileCreated: boolean;
  readonly secrets: readonly SecretLine[];
  readonly service: ServiceOutcome;
  readonly imageReady: boolean;
  readonly warnings: readonly string[];
};

export type CloneSetupOutcome =
  | { readonly kind: "needs-docker"; readonly detail: string }
  | Exclude<Preparation, { readonly kind: "ready" }>
  | LocalSetupOutcome;

type SetupHost = {
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly paths: ClonesPaths;
  readonly executable: string;
  readonly pathVariable: string;
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
  options: SetupHost & { readonly config: CloneConfig; readonly organization: boolean },
): Promise<LocalSetupOutcome> {
  const { config, paths, processes } = options;

  await saveCloneConfig({ paths, config });

  const secrets = secretLines(config);
  const created = await createSecretsFile({ paths, lines: secrets });
  const ready = await imageReady({ processes, paths, image: config.image });
  const service = await installService({
    service: cloneServeService(paths),
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
        : [`Docker could not pull ${config.image}. Clones cannot start until the image exists.`]),
    ],
  };
}

export async function setUpClones(options: SetupHost & SetupRequest): Promise<CloneSetupOutcome> {
  const { processes, paths } = options;

  await ownedDirectory(paths.directory);

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

  const prepared = await prepareClones(options);

  return prepared.kind === "ready"
    ? setUpLocal({ ...options, config: prepared.config, organization: prepared.organization })
    : prepared;
}
