import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ownedDirectory, ownedWrite } from "@shadowclone/core";
import { sessionConfigSchema, type SessionConfig } from "./config";

export type ClonesPaths = {
  readonly directory: string;
  readonly repositoriesDirectory: string;
  readonly secretsFile: string;
  readonly cursorsFile: string;
  readonly logsDirectory: string;
};

export function clonesPaths(home: string = os.homedir()): ClonesPaths {
  const directory = path.join(home, ".shadowclone", "clones");

  return {
    directory,
    repositoriesDirectory: path.join(directory, "repositories"),
    secretsFile: path.join(directory, "secrets.env"),
    cursorsFile: path.join(directory, "cursors.json"),
    logsDirectory: path.join(directory, "logs"),
  };
}

function configFile(options: { readonly paths: ClonesPaths; readonly repository: string }): string {
  return path.join(
    options.paths.repositoriesDirectory,
    `${options.repository.replace("/", "__")}.json`,
  );
}

export async function saveSessionConfig(options: {
  readonly paths: ClonesPaths;
  readonly config: SessionConfig;
}): Promise<void> {
  await ownedDirectory(options.paths.directory);
  await ownedWrite({
    path: configFile({ paths: options.paths, repository: options.config.repository }),
    content: `${JSON.stringify(sessionConfigSchema.parse(options.config), null, 2)}\n`,
  });
}

export async function readSessionConfig(options: {
  readonly paths: ClonesPaths;
  readonly repository: string;
}): Promise<SessionConfig | null> {
  const file = Bun.file(configFile(options));

  return (await file.exists()) ? sessionConfigSchema.parse(await file.json()) : null;
}

export async function listSessionConfigs(paths: ClonesPaths): Promise<readonly SessionConfig[]> {
  const names = await readdir(paths.repositoriesDirectory).catch(() => []);
  const configs: SessionConfig[] = [];

  for (const name of names.filter((entry) => entry.endsWith(".json")).sort()) {
    configs.push(
      sessionConfigSchema.parse(
        await Bun.file(path.join(paths.repositoriesDirectory, name)).json(),
      ),
    );
  }

  return configs;
}
