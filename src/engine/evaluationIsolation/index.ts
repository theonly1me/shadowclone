import { dispatchCommand } from "../dispatchIsolation";
import { canonicalPath } from "../../paths";
import { denySubpathRules, maskArguments } from "./blocked";
import type { EngineRunOptions } from "../types";

export function evaluationCommand(options: {
  readonly arguments: readonly string[];
  readonly run: EngineRunOptions;
  readonly platform?: NodeJS.Platform;
}): readonly string[] {
  if (options.run.execution.purpose === "dispatch") {
    return dispatchCommand({
      ...options,
      platform: options.platform ?? process.platform,
    });
  }
  if (options.run.execution.purpose !== "evaluation") {
    return options.arguments;
  }
  const requestedPaths = options.run.execution.blockedPaths ?? [];

  const platform = options.platform ?? process.platform;
  const blockedPaths = requestedPaths.map(canonicalPath);
  const directory = canonicalPath(options.run.cwd);

  if (platform === "darwin") {
    const sandboxProfile = `(version 1)(allow default)(deny file-write*)(allow file-write* (subpath ${JSON.stringify(directory)})(literal "/dev/null"))${denySubpathRules(
      {
        paths: blockedPaths,
        operations: ["file-read*", "file-write*"],
      },
    )}`;

    return ["sandbox-exec", "-p", sandboxProfile, ...options.arguments];
  }

  if (platform === "linux") {
    return [
      "bwrap",
      "--die-with-parent",
      "--unshare-pid",
      "--unshare-ipc",
      "--new-session",
      "--cap-drop",
      "ALL",
      "--ro-bind",
      "/",
      "/",
      "--bind",
      directory,
      directory,
      "--proc",
      "/proc",
      "--dev",
      "/dev",
      ...maskArguments(
        blockedPaths.map((directory) => ({
          path: directory,
          kind: "directory" as const,
        })),
      ),
      "--",
      ...options.arguments,
    ];
  }

  throw new Error("Evaluation isolation requires macOS or Linux");
}
