import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRun } from "../engine";
import { verificationArguments } from "./verificationSandbox";
import { renderCheckReport, runHarnessCheck } from "../harness/check";
import { runProcess } from "../io/process";
import { redactSecrets } from "../redact";
import type { CommandRunner } from "./command";

export type GateReceipt = {
  readonly status: "passed" | "failed" | "not-configured" | "not-run";
  readonly command: string | null;
  readonly attempts: number;
};

export type GateExecutor = (options: {
  readonly directory: string;
  readonly command: string;
  readonly blockedPaths: readonly string[];
  readonly protectedPaths?: readonly string[];
  readonly signal?: AbortSignal;
}) => Promise<{ readonly exitCode: number; readonly output: string }>;

const gateTimeoutMilliseconds = 15 * 60 * 1000;

export const sandboxedGate: GateExecutor = async (options) => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-gate-"),
  );

  try {
    const result = await runProcess({
      arguments: verificationArguments({
        directory: options.directory,
        arguments: ["sh", "-c", options.command],
        platform: process.platform,
        temporaryDirectory,
        blockedPaths: options.blockedPaths,
        protectedPaths: options.protectedPaths,
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
      timeoutMilliseconds: gateTimeoutMilliseconds,
      signal: options.signal,
    });

    return {
      exitCode: result.exitCode,
      output: `${result.stdout.slice(-8_000)}\n${result.stderr.slice(-4_000)}`,
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

export async function evaluateGate(options: {
  readonly directory: string;
  readonly command: string;
  readonly blockedPaths: readonly string[];
  readonly execute: GateExecutor;
  readonly runner?: CommandRunner;
}): Promise<{ readonly passed: boolean; readonly evidence: string }> {
  const gate = await options.execute({
    directory: options.directory,
    command: options.command,
    blockedPaths: options.blockedPaths,
  });
  const check = renderCheckReport({
    report: await runHarnessCheck({
      root: options.directory,
      changed: true,
      runner: options.runner,
    }),
    format: "claude-stop",
  });
  const failures = [
    gate.exitCode === 0
      ? ""
      : `\`${options.command}\` exited with code ${gate.exitCode}:\n${gate.output.trim()}`,
    check.stderr,
  ].filter((part) => part.length > 0);

  return {
    passed: gate.exitCode === 0 && check.exitCode === 0,
    evidence: redactSecrets({ text: failures.join("\n\n") }),
  };
}

export function repairPrompt(evidence: string): string {
  return [
    "The repository gate failed after your change. Fix every failure below without skipping, disabling, or weakening a check.",
    "Work only in this worktree and leave the change uncommitted.",
    "",
    evidence,
  ].join("\n");
}

export function combineRuns(options: {
  readonly first: EngineRun;
  readonly second: EngineRun;
}): EngineRun {
  const { first, second } = options;

  return {
    ...second,
    sessionId: first.sessionId,
    structured: first.structured,
    costUsd:
      first.costUsd === null || second.costUsd === null
        ? null
        : first.costUsd + second.costUsd,
    durationMs: first.durationMs + second.durationMs,
    turns: first.turns + second.turns,
    permissionDenials: [
      ...first.permissionDenials,
      ...second.permissionDenials,
    ],
    actions: [...first.actions, ...second.actions],
  };
}
