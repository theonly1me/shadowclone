import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { redactSecrets } from "../../redact";
import type { CheckResult } from "./types";

const packageManifestSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
});

export function verificationArguments(options: {
  readonly directory: string;
  readonly arguments: readonly string[];
  readonly platform: NodeJS.Platform;
}): readonly string[] {
  if (options.platform === "darwin") {
    const profile = `(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath ${JSON.stringify(options.directory)})(subpath "/private/tmp")(subpath "/dev"))`;
    return ["sandbox-exec", "-p", profile, ...options.arguments];
  }

  if (options.platform === "linux") {
    return [
      "bwrap",
      "--die-with-parent",
      "--unshare-net",
      "--ro-bind",
      "/",
      "/",
      "--bind",
      options.directory,
      options.directory,
      "--tmpfs",
      "/tmp",
      "--dev",
      "/dev",
      "--proc",
      "/proc",
      "--chdir",
      options.directory,
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
}): Promise<CheckResult> {
  const child = Bun.spawn({
    cmd: [
      ...verificationArguments({
        directory: options.directory,
        arguments: options.arguments,
        platform: process.platform,
      }),
    ],
    cwd: options.directory,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PATH: process.env.PATH,
      HOME: options.directory,
      TMPDIR: options.directory,
      CI: "true",
    },
    signal: AbortSignal.timeout(options.timeoutSeconds * 1000),
  });

  const [exitCode, standardOutput, standardError] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

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
}): Promise<readonly CheckResult[]> {
  const manifestFile = Bun.file(path.join(options.directory, "package.json"));
  if (!(await manifestFile.exists())) {
    return [
      {
        requirement: "Independent repository verification",
        verdict: "uncertain",
        evidence: "No supported package manifest",
      },
    ];
  }

  const manifestData = await manifestFile.json();
  const parsedManifest = packageManifestSchema.safeParse(manifestData);
  const scripts = parsedManifest.success
    ? parsedManifest.data.scripts ?? {}
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
    });
    results.push(checkResult);
  }

  return results;
}
