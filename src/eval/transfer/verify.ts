import { readBoundedFile } from "../../io/files";
import { runProcess } from "../../io/process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { denySubpathRules, maskArguments } from "../../engine";
import { canonicalPath } from "../../paths";
import { redactSecrets } from "../../redact";
import { sensitivePaths } from "./sensitivePaths";
import type { CheckResult } from "./types";

const packageManifestSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
});

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

function detectPackageManager(directory: string): string {
  if (
    existsSync(path.join(directory, "bun.lock")) ||
    existsSync(path.join(directory, "bun.lockb"))
  ) {
    return "bun";
  }

  if (existsSync(path.join(directory, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  return "npm";
}

async function runCheck(options: {
  readonly directory: string;
  readonly arguments: readonly string[];
  readonly timeoutSeconds: number;
  readonly blockedPaths?: readonly string[];
}): Promise<CheckResult> {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-verify-"),
  );
  const result = await runProcess({
    arguments: verificationArguments({
      directory: options.directory,
      arguments: options.arguments,
      platform: process.platform,
      temporaryDirectory,
      blockedPaths: options.blockedPaths,
    }),
    cwd: options.directory,
    environment: {
      PATH: process.env.PATH,
      HOME: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      TMP: temporaryDirectory,
      TEMP: temporaryDirectory,
      CI: "true",
    },
    timeoutMilliseconds: options.timeoutSeconds * 1000,
  }).finally(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const { exitCode, stdout: standardOutput, stderr: standardError } = result;

  const evidenceText = `Exit code ${exitCode}\n${standardOutput.slice(-12000)}\n${standardError.slice(-4000)}`;

  return {
    requirement: `Independent check: ${options.arguments.join(" ")}`,
    verdict: exitCode === 0 ? "pass" : "fail",
    evidence: redactSecrets({ text: evidenceText }),
  };
}

export async function verifyWorkspace(options: {
  readonly directory: string;
  readonly timeoutSeconds: number;
  readonly blockedPaths?: readonly string[];
}): Promise<readonly CheckResult[]> {
  const manifest = await readBoundedFile({
    filePath: path.join(options.directory, "package.json"),
    roots: [options.directory],
    maximumBytes: 1024 * 1024,
  });
  if (manifest === null) {
    return [
      {
        requirement: "Independent repository verification",
        verdict: "uncertain",
        evidence: "No safe supported package manifest within the size limit",
      },
    ];
  }

  const manifestData: unknown = JSON.parse(manifest);
  const parsedManifest = packageManifestSchema.safeParse(manifestData);
  const scripts = parsedManifest.success
    ? (parsedManifest.data.scripts ?? {})
    : {};

  const scriptNames = ["test", "typecheck"].filter(
    (name) => typeof scripts[name] === "string",
  );
  if (scriptNames.length === 0) {
    return [
      {
        requirement: "Independent repository verification",
        verdict: "uncertain",
        evidence: "No test or typecheck script",
      },
    ];
  }

  const packageManager = detectPackageManager(options.directory);
  const results: CheckResult[] = [];

  for (const scriptName of scriptNames) {
    const checkResult = await runCheck({
      directory: options.directory,
      arguments: [packageManager, "run", scriptName],
      timeoutSeconds: options.timeoutSeconds,
      blockedPaths: options.blockedPaths,
    });
    results.push(checkResult);
  }

  return results;
}
