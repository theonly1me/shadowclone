import os from "node:os";
import { canonicalPath } from "../../../paths";

export function contractSandbox(options: {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly directory: string;
  readonly port: number;
  readonly readOnlyPaths?: readonly string[];
}): readonly string[] {
  if (process.platform !== "darwin") throw new Error("The local Claude schema contract probe currently requires macOS isolation");
  const directory = canonicalPath(options.directory);
  const profile = [
    "(version 1)(allow default)(deny network*)(deny file-write*)",
    `(allow file-write* (subpath ${JSON.stringify(directory)})(literal "/dev/null"))`,
    `(deny file-read* (subpath ${JSON.stringify(canonicalPath(os.homedir()))}))`,
    `(allow network-outbound (remote ip "localhost:${options.port}"))`,
    ...(options.readOnlyPaths ?? []).map((entry) => `(deny file-write* (subpath ${JSON.stringify(canonicalPath(entry))}))`),
  ].join("");
  return ["sandbox-exec", "-p", profile, options.executable, ...options.arguments];
}
