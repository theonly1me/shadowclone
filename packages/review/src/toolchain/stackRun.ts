import type { DiffFile } from "../collect";
import type { Worktree } from "../worktree";
import { limitToChanges, subtractBase } from "./compare";
import { diagnosticsAt, prepareSide, type Side, type ToolBudget } from "./stackExecution";
import type { CommandReport, Diagnostic, Stack } from "./types";

const maximumDiagnostics = 50;

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
  const report = (
    tool: string,
    status: CommandReport["status"],
    detail: string,
    diagnostics: readonly Diagnostic[] = [],
  ): CommandReport => ({
    stack: label,
    tool,
    status,
    detail,
    diagnostics: diagnostics.slice(0, maximumDiagnostics),
  });

  options.onProgress(`${label}: installing at the head`);
  const head = await prepareSide({
    stack,
    worktree: options.head,
    directory,
    changedFiles,
    budget,
  });

  if (typeof head === "string") {
    return [report("install", "failed", head)];
  }

  let baseSide: Promise<Side | string> | null = null;
  const base = () => {
    baseSide ??= options
      .base()
      .then((worktree) => prepareSide({ stack, worktree, directory, changedFiles, budget }));
    return baseSide;
  };
  const reports: CommandReport[] = [];

  for (const command of stack.commands.filter(
    (candidate) => candidate.command(head.context) !== null,
  )) {
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
      reports.push(
        report(
          command.tool,
          "ran",
          "limited to changed lines",
          limitToChanges({ diagnostics: atHead.diagnostics, files, scope: command.scope }),
        ),
      );
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
      const reason =
        typeof side === "string"
          ? side
          : atBase === null
            ? "not configured at the base"
            : atBase.failure;
      reports.push(
        report(
          command.tool,
          "ran",
          `the base could not be checked (${reason}); showing diagnostics in changed files`,
          limitToChanges({ diagnostics: atHead.diagnostics, files, scope: "changed-files" }),
        ),
      );
      continue;
    }

    const added = subtractBase({ head: atHead.diagnostics, base: atBase.diagnostics });
    reports.push(
      report(
        command.tool,
        "ran",
        `${added.length} new of ${atHead.diagnostics.length} at the head`,
        added,
      ),
    );
  }

  return reports;
}
