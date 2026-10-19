import os from "node:os";
import path from "node:path";

export type HubPaths = {
  readonly directory: string;
  readonly database: string;
  readonly lockFile: string;
  readonly logsDirectory: string;
  readonly linkFile: string;
};

export function hubPaths(home: string = os.homedir()): HubPaths {
  const directory = path.join(home, ".shadowclone", "hub");

  return {
    directory,
    database: path.join(directory, "hub.db"),
    lockFile: path.join(directory, "hub.lock"),
    logsDirectory: path.join(directory, "logs"),
    linkFile: path.join(directory, "link.json"),
  };
}
