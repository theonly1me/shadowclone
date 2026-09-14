import path from "node:path";
import { existsSync, lstatSync } from "node:fs";
import { sensitivePaths } from "../io/sensitivePaths";
import { canonicalPath } from "../paths";
import type { EngineRunOptions } from "./types";

export function dispatchCommand(options: {
  readonly arguments: readonly string[];
  readonly run: EngineRunOptions;
  readonly platform: NodeJS.Platform;
}): readonly string[] {
  const execution = options.run.execution;
  if (execution.purpose !== "dispatch") {
    return options.arguments;
  }
  const directory = canonicalPath(options.run.cwd);
  const temporary = canonicalPath(execution.temporaryDirectory ?? directory);
  const blocked = (execution.blockedPaths ?? []).map(canonicalPath);
  const profile = options.run.systemPromptFile
    ? canonicalPath(options.run.systemPromptFile)
    : null;
  const gitDirectory = execution.repositoryDirectory
    ? canonicalPath(path.join(execution.repositoryDirectory, ".git"))
    : null;
  if (
    gitDirectory &&
    existsSync(gitDirectory) &&
    !lstatSync(gitDirectory).isDirectory()
  ) {
    throw new Error(
      "Dispatch requires the primary repository checkout as its target",
    );
  }
  const protectedFiles = [".git", ".claude", ".codex", ".mcp.json"].map(
    (entry) => path.join(directory, entry),
  );
  const credentials = sensitivePaths().filter(
    (entry) =>
      ![".claude", ".codex", ".cursor", ".gemini", ".shadowclone"].includes(
        path.basename(entry.path),
      ),
  );
  if (options.platform === "darwin") {
    const allowed = [directory, temporary];
    const exclusions = [
      ...allowed.map(
        (entry) => `(require-not (subpath ${JSON.stringify(entry)}))`,
      ),
      ...(profile
        ? [`(require-not (literal ${JSON.stringify(profile)}))`]
        : []),
      ...(gitDirectory
        ? [`(require-not (subpath ${JSON.stringify(gitDirectory)}))`]
        : []),
    ].join("");
    const denies = blocked
      .map(
        (entry) =>
          `(deny file-read* (require-all (subpath ${JSON.stringify(entry)})${exclusions}))`,
      )
      .join("");
    const protectedPaths = protectedFiles
      .map((entry) => `(deny file-write* (subpath ${JSON.stringify(entry)}))`)
      .join("");
    const credentialRules = credentials
      .map(
        (entry) => `(deny file-read* (subpath ${JSON.stringify(entry.path)}))`,
      )
      .join("");
    const writes = allowed
      .map((entry) => `(subpath ${JSON.stringify(entry)})`)
      .join("");
    return [
      "sandbox-exec",
      "-p",
      `(version 1)(allow default)(deny file-write*)(allow file-write* ${writes}(literal "/dev/null"))${denies}${protectedPaths}${credentialRules}`,
      ...options.arguments,
    ];
  }
  if (options.platform === "linux") {
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
      ...blocked.flatMap((entry) => ["--tmpfs", entry]),
      "--bind",
      directory,
      directory,
      "--bind",
      temporary,
      temporary,
      ...(profile ? ["--ro-bind", profile, profile] : []),
      ...(gitDirectory ? ["--ro-bind", gitDirectory, gitDirectory] : []),
      ...protectedFiles
        .filter(existsSync)
        .flatMap((entry) => ["--ro-bind", entry, entry]),
      ...credentials
        .filter((entry) => existsSync(entry.path))
        .flatMap((entry) =>
          entry.kind === "directory"
            ? ["--tmpfs", entry.path]
            : ["--ro-bind", "/dev/null", entry.path],
        ),
      "--proc",
      "/proc",
      "--dev",
      "/dev",
      "--",
      ...options.arguments,
    ];
  }
  throw new Error("Dispatch isolation requires macOS or Linux");
}
