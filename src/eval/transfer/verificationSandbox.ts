import { existsSync } from "node:fs";
import { denySubpathRules, maskArguments } from "../../engine";
import { canonicalPath } from "../../paths";
import { sensitivePaths } from "./sensitivePaths";

export function verificationArguments(options: {
  readonly directory: string;
  readonly arguments: readonly string[];
  readonly platform: NodeJS.Platform;
  readonly homeDirectory?: string;
  readonly temporaryDirectory?: string;
  readonly blockedPaths?: readonly string[];
}): readonly string[] {
  const directory = canonicalPath(options.directory);

  const blocked = [
    ...sensitivePaths(options.homeDirectory),
    ...(options.blockedPaths ?? []).map((entry) => ({
      path: canonicalPath(entry),
      kind: "directory" as const,
    })),
  ];

  const temporary = canonicalPath(
    options.temporaryDirectory ?? options.directory,
  );

  if (options.platform === "darwin") {
    const denied = denySubpathRules({
      paths: blocked.map((entry) => entry.path),
      operations: ["file-read*", "file-write*"],
    });
    const profile = `(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath ${JSON.stringify(directory)})(subpath ${JSON.stringify(temporary)})(literal "/dev/null"))(deny appleevent-send)(deny mach-lookup)(deny ipc-posix-shm*)(deny ipc-posix-sem*)(deny signal (require-not (target self)))${denied}`;

    return ["sandbox-exec", "-p", profile, ...options.arguments];
  }

  if (options.platform === "linux") {
    return [
      "bwrap",
      "--die-with-parent",
      "--unshare-net",
      "--unshare-pid",
      "--unshare-ipc",
      "--new-session",
      "--cap-drop",
      "ALL",
      "--ro-bind",
      "/",
      "/",
      "--tmpfs",
      "/tmp",
      "--dev",
      "/dev",
      "--proc",
      "/proc",
      ...maskArguments(blocked.filter((entry) => existsSync(entry.path))),
      "--bind",
      directory,
      directory,
      "--bind",
      temporary,
      temporary,
      "--chdir",
      directory,
      "--",
      ...options.arguments,
    ];
  }

  throw new Error(
    "Independent verification requires macOS sandbox-exec or Linux bubblewrap",
  );
}
