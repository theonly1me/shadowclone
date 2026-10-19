import os from "node:os";
import path from "node:path";

export type LivePaths = {
  readonly home: string;
  readonly directory: string;
  readonly pendingMarker: string;
};

export function livePaths(home: string = os.homedir()): LivePaths {
  const directory = path.join(home, ".shadowclone", "live");

  return { home, directory, pendingMarker: path.join(directory, "pending") };
}
