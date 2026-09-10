import { canonicalPath } from "../../paths";
import { denySubpathRules, maskArguments } from "./blocked";
import type { EngineRunOptions } from "../types";

export function evaluationCommand(options: {
  readonly arguments: readonly string[];
  readonly run: EngineRunOptions;
  readonly platform?: NodeJS.Platform;
}): readonly string[] {
  if (options.run.execution.purpose !== "evaluation") {
    return options.arguments;
  }
  const requestedPaths = options.run.execution.blockedPaths ?? [];
  if (requestedPaths.length === 0) {
    return options.arguments;
  }

  const platform = options.platform ?? process.platform;
  const blockedPaths = requestedPaths.map(canonicalPath);

  if (platform === "darwin") {
    const sandboxProfile = `(version 1)(allow default)${denySubpathRules({
      paths: blockedPaths,
      operations: ["file-read*", "file-write*"],
    })}`;

    return ["sandbox-exec", "-p", sandboxProfile, ...options.arguments];
  }

  if (platform === "linux") {
    return [
      "bwrap",
      "--die-with-parent",
      "--bind",
      "/",
      "/",
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
