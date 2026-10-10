import path from "node:path";
import { redactSecrets } from "@shadowclone/redact";
import type { DiffFile } from "../collect";
import type { Worktree } from "../worktree";
import { limitToChanges, subtractBase } from "./compare";
import { parseDiagnostics } from "./parsers";
import { runTool, type ToolRun } from "./process";
import { projectContext } from "./projects";
import type { CommandReport, Diagnostic, Stack, StackContext, ToolCommand } from "./types";

const commandTimeoutMilliseconds = 10 * 60_000;

export type ToolBudget = { readonly deadline: number; readonly environment: Readonly<Record<string, string>> };
const maximumDiagnostics = 50;

type Side = { readonly context: StackContext; readonly roots: readonly string[]; readonly directory: string };

function describe(run: Exclude<ToolRun, { kind: "finished" }>): string {
  if (run.kind === "missing") {
    return `${run.executable} is not installed`;
  }

  return run.kind === "timed-out" ? "timed out" : "printed more output than the limit";
}

async function runWithinBudget(options: { readonly arguments: readonly string[]; readonly cwd: string; readonly budget: ToolBudget }): Promise<ToolRun | "budget"> {
  const remaining = options.budget.deadline - Date.now();

  if (remaining <= 0) {
    return "budget";
  }

  return runTool({
    arguments: options.arguments,
    cwd: options.cwd,
    timeoutMilliseconds: Math.min(commandTimeoutMilliseconds, remaining),
    environment: options.budget.environment,
  });
}

const budgetSpent = "not run, because the toolchain time budget ran out";

function outputTail(output: string): string {
  return redactSecrets({ text: output.trim().slice(-600) });
}

async function prepareSide(options: {
  readonly stack: Stack;
  readonly worktree: Worktree;
  readonly directory: string;
  readonly changedFiles: readonly string[];
  readonly budget: ToolBudget;
}): Promise<Side | string> {
  const { directory } = options;
  const context = projectContext({ root: options.worktree.root, directory, changedFiles: options.changedFiles });
  const install = options.stack.install(context);

  if (install !== null) {
    const run = await runWithinBudget({ arguments: install, cwd: context.root, budget: options.budget });

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

  return { context, roots: options.worktree.roots.map((root) => path.join(root, directory)), directory };
}

async function diagnosticsAt(options: {
  readonly side: Side;
  readonly command: ToolCommand;
  readonly budget: ToolBudget;
}): Promise<{ readonly diagnostics: readonly Diagnostic[] } | { readonly failure: string; readonly status: CommandReport["status"] } | null> {
  const arguments_ = options.command.command(options.side.context);

  if (arguments_ === null) {
    return null;
  }

  const run = await runWithinBudget({ arguments: arguments_, cwd: options.side.context.root, budget: options.budget });

  if (run === "budget") {
    return { failure: budgetSpent, status: "timed-out" };
  }

  if (run.kind !== "finished") {
    return { failure: describe(run), status: run.kind === "missing" ? "skipped" : run.kind === "timed-out" ? "timed-out" : "failed" };
  }

  const { directory } = options.side;
  const diagnostics = parseDiagnostics({
    tool: options.command.tool,
    parser: options.command.parser,
    output: run.output,
    roots: options.side.roots,
  }).map((diagnostic) => (directory === "" ? diagnostic : { ...diagnostic, path: path.posix.join(directory, diagnostic.path) }));

  return run.exitCode !== 0 && diagnostics.length === 0
    ? { failure: outputTail(run.output), status: "failed" }
    : { diagnostics };
}

export async function runStack(options: {
  readonly stack: Stack;
  readonly directory: string;
  readonly head: Worktree;
  readonly base: () => Promise<Worktree>;
  readonly files: readonly DiffFile[];
  readonly onProgress: (message: string) => void;
  readonly budget: ToolBudget;
}): Promise<readonly CommandReport[]> {
  const { stack, files, directory, budget } = options;
  const label = directory === "" ? stack.id : `${stack.id} (${directory})`;
  const changedFiles = files.filter((file) => !file.deleted).map((file) => file.path);
  const report = (tool: string, status: CommandReport["status"], detail: string, diagnostics: readonly Diagnostic[] = []): CommandReport =>
    ({ stack: label, tool, status, detail, diagnostics: diagnostics.slice(0, maximumDiagnostics) });

  options.onProgress(`${label}: installing at the head`);
  const head = await prepareSide({ stack, worktree: options.head, directory, changedFiles, budget });

  if (typeof head === "string") {
    return [report("install", "failed", head)];
  }

  let baseSide: Promise<Side | string> | null = null;
  const base = () => {
    baseSide ??= options.base().then((worktree) => prepareSide({ stack, worktree, directory, changedFiles, budget }));
    return baseSide;
  };
  const reports: CommandReport[] = [];

  for (const command of stack.commands.filter((candidate) => candidate.command(head.context) !== null)) {
    options.onProgress(`${label}: ${command.tool} at the head`);
    const atHead = await diagnosticsAt({ side: head, command, budget });

    if (atHead === null) {
      continue;
    }

    if ("failure" in atHead) {
      reports.push(report(command.tool, atHead.status, atHead.failure));
      continue;
    }

    if (command.scope !== "new-in-head") {
      reports.push(report(command.tool, "ran", "limited to changed lines", limitToChanges({ diagnostics: atHead.diagnostics, files, scope: command.scope })));
      continue;
    }

    if (atHead.diagnostics.length === 0) {
      reports.push(report(command.tool, "ran", "no diagnostics at the head"));
      continue;
    }

    options.onProgress(`${label}: ${command.tool} at the base`);
    const side = await base();
    const atBase = typeof side === "string" ? null : await diagnosticsAt({ side, command, budget });

    if (atBase === null || "failure" in atBase) {
      const reason = typeof side === "string" ? side : atBase === null ? "not configured at the base" : atBase.failure;
      reports.push(report(command.tool, "ran", `the base could not be checked (${reason}); showing diagnostics in changed files`, limitToChanges({ diagnostics: atHead.diagnostics, files, scope: "changed-files" })));
      continue;
    }

    const added = subtractBase({ head: atHead.diagnostics, base: atBase.diagnostics });
    reports.push(report(command.tool, "ran", `${added.length} new of ${atHead.diagnostics.length} at the head`, added));
  }

  return reports;
}
