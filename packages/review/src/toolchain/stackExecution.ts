import path from "node:path";
import { redactSecrets } from "@shadowclone/redact";
import type { Worktree } from "../worktree";
import { parseDiagnostics } from "./parsers";
import { runTool, type ToolRun } from "./process";
import { projectContext } from "./projects";
import type { CommandReport, Diagnostic, Stack, StackContext, ToolCommand } from "./types";

const commandTimeoutMilliseconds = 10 * 60_000;

export type ToolBudget = {
  readonly deadline: number;
  readonly environment: Readonly<Record<string, string>>;
  readonly stateDirectory?: string;
};

export type Side = {
  readonly context: StackContext;
  readonly roots: readonly string[];
  readonly directory: string;
  readonly workspaceRoot: string;
};

function describe(run: Exclude<ToolRun, { kind: "finished" }>): string {
  if (run.kind === "missing") {
    return `${run.executable} is not installed`;
  }

  if (run.kind === "sandbox-unavailable") {
    return `sandbox unavailable: ${run.detail}`;
  }

  return run.kind === "timed-out" ? "timed out" : "printed more output than the limit";
}

async function runWithinBudget(options: {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly workspaceRoot: string;
  readonly budget: ToolBudget;
}): Promise<ToolRun | "budget"> {
  const remaining = options.budget.deadline - Date.now();

  if (remaining <= 0) {
    return "budget";
  }

  return runTool({
    arguments: options.arguments,
    cwd: options.cwd,
    timeoutMilliseconds: Math.min(commandTimeoutMilliseconds, remaining),
    environment: options.budget.environment,
    workspaceRoot: options.workspaceRoot,
    stateDirectory: options.budget.stateDirectory,
  });
}

const budgetSpent = "not run, because the toolchain time budget ran out";

function outputTail(output: string): string {
  return redactSecrets({ text: output.trim().slice(-600) });
}

export async function prepareSide(options: {
  readonly stack: Stack;
  readonly worktree: Worktree;
  readonly directory: string;
  readonly changedFiles: readonly string[];
  readonly budget: ToolBudget;
}): Promise<Side | string> {
  const { directory } = options;
  const context = projectContext({
    root: options.worktree.root,
    directory,
    changedFiles: options.changedFiles,
  });
  const install = options.stack.install(context);

  if (install !== null) {
    const run = await runWithinBudget({
      arguments: install,
      cwd: context.root,
      workspaceRoot: options.worktree.root,
      budget: options.budget,
    });

    if (run === "budget") {
      return `install ${budgetSpent}`;
    }

    if (run.kind !== "finished") {
      return `install ${describe(run)}`;
    }

    if (run.exitCode !== 0) {
      return `install failed: ${outputTail(run.output)}`;
    }
  }

  return {
    context,
    roots: options.worktree.roots.map((root) => path.join(root, directory)),
    directory,
    workspaceRoot: options.worktree.root,
  };
}

export async function diagnosticsAt(options: {
  readonly side: Side;
  readonly command: ToolCommand;
  readonly budget: ToolBudget;
}): Promise<
  | { readonly diagnostics: readonly Diagnostic[] }
  | { readonly failure: string; readonly status: CommandReport["status"] }
  | null
> {
  const arguments_ = options.command.command(options.side.context);

  if (arguments_ === null) {
    return null;
  }

  const run = await runWithinBudget({
    arguments: arguments_,
    cwd: options.side.context.root,
    workspaceRoot: options.side.workspaceRoot,
    budget: options.budget,
  });

  if (run === "budget") {
    return { failure: budgetSpent, status: "timed-out" };
  }

  if (run.kind !== "finished") {
    return {
      failure: describe(run),
      status:
        run.kind === "missing" ? "skipped" : run.kind === "timed-out" ? "timed-out" : "failed",
    };
  }

  const { directory } = options.side;
  const diagnostics = parseDiagnostics({
    tool: options.command.tool,
    parser: options.command.parser,
    output: run.output,
    roots: options.side.roots,
  }).map((diagnostic) =>
    directory === ""
      ? diagnostic
      : { ...diagnostic, path: path.posix.join(directory, diagnostic.path) },
  );

  return run.exitCode !== 0 && diagnostics.length === 0
    ? { failure: outputTail(run.output), status: "failed" }
    : { diagnostics };
}
