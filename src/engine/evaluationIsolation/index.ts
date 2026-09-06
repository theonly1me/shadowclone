import type { EngineRunOptions } from "../types";

export function evaluationCommand(options: {
  readonly arguments: readonly string[];
  readonly run: EngineRunOptions;
  readonly platform?: NodeJS.Platform;
}): readonly string[] {
  const blockedPaths = options.run.evaluationBlockedPaths ?? [];
  if (!options.run.evaluation || blockedPaths.length === 0) {
    return options.arguments;
  }

  const platform = options.platform ?? process.platform;

  if (platform === "darwin") {
    const predicates = blockedPaths
      .map((directory) => `(subpath ${JSON.stringify(directory)})`)
      .join(" ");

    const sandboxProfile = `(version 1)(allow default)(deny file-read* ${predicates})(deny file-write* ${predicates})`;

    return ["sandbox-exec", "-p", sandboxProfile, ...options.arguments];
  }

  if (platform === "linux") {
    const tmpfsArguments = blockedPaths.flatMap((directory) => [
      "--tmpfs",
      directory,
    ]);

    return [
      "bwrap",
      "--die-with-parent",
      "--bind",
      "/",
      "/",
      ...tmpfsArguments,
      "--",
      ...options.arguments,
    ];
  }

  throw new Error("Evaluation isolation requires macOS or Linux");
}
