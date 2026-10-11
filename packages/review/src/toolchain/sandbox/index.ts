import { existsSync } from "node:fs";
import { realpath, rm } from "node:fs/promises";
import path from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { ProcessLimitError, runProcess } from "@shadowclone/core";
import { sandboxCommand } from "./command";
import { sandboxPolicy } from "./policy";
import { runtimeReadPaths } from "./runtimes";
import { isolatedEnvironment, sandboxState } from "./state";

export type SandboxRun =
  | { readonly kind: "finished"; readonly exitCode: number; readonly output: string }
  | { readonly kind: "timed-out" }
  | { readonly kind: "too-much-output" }
  | { readonly kind: "sandbox-unavailable"; readonly detail: string };

type Options = {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly workspaceRoot?: string;
  readonly stateDirectory?: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly timeoutMilliseconds: number;
};

let previousRun: Promise<unknown> = Promise.resolve();

async function execute(options: Options & { readonly deadline: number }): Promise<SandboxRun> {
  if (options.deadline <= Date.now()) {
    return { kind: "timed-out" };
  }

  if (process.platform !== "darwin" && process.platform !== "linux") {
    return {
      kind: "sandbox-unavailable",
      detail:
        "Toolchain isolation requires macOS or Linux. Use --no-checks to review without toolchain checks.",
    };
  }

  const workspace = await realpath(options.workspaceRoot ?? options.cwd);
  const cwd = await realpath(options.cwd);

  if (cwd !== workspace && !cwd.startsWith(`${workspace}${path.sep}`)) {
    return {
      kind: "sandbox-unavailable",
      detail: "The toolchain directory is outside its worktree.",
    };
  }

  const state = await sandboxState({ workspace, stateDirectory: options.stateDirectory });

  try {
    const environment = isolatedEnvironment({
      source: options.environment,
      state: state.directory,
    });
    const policy = sandboxPolicy({
      workspace,
      state: state.directory,
      runtimePaths: runtimeReadPaths(options.environment),
      environment,
    });

    if (process.platform === "linux" && !existsSync(policy.seccomp?.applyPath ?? "")) {
      return {
        kind: "sandbox-unavailable",
        detail:
          "The sandbox Unix socket filter is missing. Reinstall Shadowclone before running checks.",
      };
    }

    await SandboxManager.initialize(policy);
    const remaining = options.deadline - Date.now();

    if (remaining <= 0) {
      return { kind: "timed-out" };
    }

    const command = sandboxCommand({
      arguments: options.arguments,
      temporary: path.join(state.directory, "temporary"),
    });
    const proxySockets = [
      SandboxManager.getLinuxHttpSocketPath(),
      SandboxManager.getLinuxSocksSocketPath(),
    ].flatMap((socket) => (socket === undefined ? [] : [{ path: socket, literal: true as const }]));
    const wrapped = await SandboxManager.wrapWithSandbox(
      command,
      "/bin/bash",
      {
        filesystem: {
          ...policy.filesystem,
          allowRead: [...(policy.filesystem.allowRead ?? []), ...proxySockets],
        },
      },
      AbortSignal.timeout(remaining),
    );
    const timeoutMilliseconds = options.deadline - Date.now();

    if (timeoutMilliseconds <= 0) {
      return { kind: "timed-out" };
    }

    try {
      const result = await runProcess({
        arguments: ["/bin/bash", "-c", wrapped],
        cwd,
        environment,
        timeoutMilliseconds,
      });

      return {
        kind: "finished",
        exitCode: result.exitCode,
        output: `${result.stdout}\n${result.stderr}`,
      };
    } catch (error) {
      if (!(error instanceof ProcessLimitError)) {
        throw error;
      }

      return error.message === "Process output limit exceeded"
        ? { kind: "too-much-output" }
        : { kind: "timed-out" };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The sandbox could not start";
    return {
      kind: "sandbox-unavailable",
      detail: `${detail}. Install the sandbox prerequisites or use --no-checks.`,
    };
  } finally {
    await SandboxManager.reset();

    if (state.disposable) {
      await rm(state.directory, { recursive: true, force: true });
    }
  }
}

export function runSandboxedTool(options: Options): Promise<SandboxRun> {
  const deadline = Date.now() + options.timeoutMilliseconds;
  const run = previousRun.then(() => execute({ ...options, deadline }));
  previousRun = run.catch(() => undefined);
  return run;
}
