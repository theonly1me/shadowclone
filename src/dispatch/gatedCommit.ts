import type { EngineRun } from "../engine";
import { prepareDependencies } from "../eval/transfer/dependencies";
import { readHarnessManifest } from "../harness/manifest";
import { runCommand, type CommandRunner } from "./command";
import {
  combineRuns,
  evaluateGate,
  sandboxedGate,
  type GateExecutor,
  type GateReceipt,
} from "./gate";
import { commitWorktree, type Worktree } from "./worktree";

export async function prepareWorktreeDependencies(options: {
  readonly worktree: Worktree;
  readonly runner?: CommandRunner;
}): Promise<void> {
  const ignored = await (options.runner ?? runCommand)({
    command: ["git", "check-ignore", "-q", "node_modules"],
    cwd: options.worktree.worktreeDirectory,
  });

  if (ignored.exitCode !== 0) {
    return;
  }

  await prepareDependencies({
    repository: options.worktree.repoDirectory,
    directory: options.worktree.worktreeDirectory,
  }).catch(() => undefined);
}

async function gateCommand(
  directory: string,
): Promise<string | null | "invalid"> {
  try {
    return (await readHarnessManifest(directory))?.gate?.command ?? null;
  } catch {
    return "invalid";
  }
}

export async function gateAndCommit(options: {
  readonly worktree: Worktree;
  readonly run: EngineRun;
  readonly repair: (evidence: string) => Promise<EngineRun>;
  readonly blockedPaths: readonly string[];
  readonly execute?: GateExecutor;
  readonly runner?: CommandRunner;
}): Promise<{ readonly run: EngineRun; readonly gate: GateReceipt }> {
  const directory = options.worktree.worktreeDirectory;
  const command = await gateCommand(directory);

  if (command === "invalid") {
    return {
      run: options.run,
      gate: { status: "failed", command: null, attempts: 0 },
    };
  }

  if (command === null) {
    await commitWorktree({
      worktree: options.worktree,
      runner: options.runner,
    });

    return {
      run: options.run,
      gate: { status: "not-configured", command: null, attempts: 0 },
    };
  }

  const evaluate = () =>
    evaluateGate({
      directory,
      command,
      blockedPaths: options.blockedPaths,
      execute: options.execute ?? sandboxedGate,
      runner: options.runner,
    });
  const first = await evaluate();
  let run = options.run;
  let passed = first.passed;

  if (!passed) {
    const repaired = await options.repair(first.evidence);

    run = combineRuns({ first: options.run, second: repaired });
    passed = !repaired.isError && (await evaluate()).passed;
  }

  if (passed) {
    await commitWorktree({
      worktree: options.worktree,
      runner: options.runner,
    });
  }

  return {
    run,
    gate: {
      status: passed ? "passed" : "failed",
      command,
      attempts: first.passed ? 1 : 2,
    },
  };
}
