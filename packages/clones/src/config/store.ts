import os from "node:os";
import path from "node:path";
import { ownedDirectory, ownedWrite } from "@shadowclone/core";
import { cloneConfigSchema, cloneConfigVersion, type CloneConfig } from "./config";

export type ClonesPaths = {
  readonly directory: string;
  readonly repositoriesDirectory: string;
  readonly runsDirectory: string;
  readonly secretsFile: string;
  readonly serveLockFile: string;
  readonly logsDirectory: string;
};

export function clonesPaths(home: string = os.homedir()): ClonesPaths {
  const directory = path.join(home, ".shadowclone", "clones");

  return {
    directory,
    repositoriesDirectory: path.join(directory, "repositories"),
    runsDirectory: path.join(directory, "runs"),
    secretsFile: path.join(directory, "secrets.env"),
    serveLockFile: path.join(directory, "serve.lock"),
    logsDirectory: path.join(directory, "logs"),
  };
}

function configFile(options: { readonly paths: ClonesPaths; readonly repository: string }): string {
  return path.join(
    options.paths.repositoriesDirectory,
    `${options.repository.replace("/", "__")}.json`,
  );
}

export function setupAgainMessage(repository: string): string {
  return `The clone setup for ${repository} is from an earlier version of shadowclone. Run shadowclone clone setup --repo ${repository} again.`;
}

export async function saveCloneConfig(options: {
  readonly paths: ClonesPaths;
  readonly config: CloneConfig;
}): Promise<void> {
  await ownedDirectory(options.paths.directory);
  await ownedWrite({
    path: configFile({ paths: options.paths, repository: options.config.repository }),
    content: `${JSON.stringify(cloneConfigSchema.parse(options.config), null, 2)}\n`,
  });
}

function hasEarlierVersion(saved: unknown): boolean {
  return (
    typeof saved === "object" &&
    saved !== null &&
    "version" in saved &&
    typeof saved.version === "number" &&
    saved.version < cloneConfigVersion
  );
}

export async function readCloneConfig(options: {
  readonly paths: ClonesPaths;
  readonly repository: string;
}): Promise<CloneConfig | null> {
  const file = Bun.file(configFile(options));

  if (!(await file.exists())) {
    return null;
  }

  const saved: unknown = await file.json();

  if (hasEarlierVersion(saved)) {
    throw new Error(setupAgainMessage(options.repository));
  }

  return cloneConfigSchema.parse(saved);
}
