import path from "node:path";
import type { EngineAction } from "../engine";
import type { IndexedEvent } from "../index";
import type { SessionBehavior } from "./types";

const editTools = new Set(["Edit", "Write", "NotebookEdit"]);
const planTools = new Set([
  "ExitPlanMode",
  "TodoWrite",
  "Plan",
  "EnterPlanMode",
]);

export function normalizeRepoPath(options: {
  readonly rawPath: string;
  readonly cwd?: string;
}): string {
  const normalized = path.posix.normalize(
    options.rawPath.replaceAll("\\", "/"),
  );
  if (options.cwd) {
    const normalizedCwd = path.posix.normalize(
      options.cwd.replaceAll("\\", "/"),
    );
    if (normalized.startsWith(normalizedCwd)) {
      return path.posix.relative(normalizedCwd, normalized);
    }
  }
  return normalized;
}

export function extractVerificationToken(command: string): string {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  return tokens.slice(0, 2).join(" ");
}

export function extractBehaviorFromActions(options: {
  readonly actions: readonly EngineAction[];
  readonly cwd?: string;
}): SessionBehavior {
  const tools = [...new Set(options.actions.map((a) => a.tool))];
  const files: string[] = [];
  const verificationSteps: string[] = [];
  let plannedBeforeEditing = false;
  let seenEdit = false;
  let seenPlan = false;

  for (const action of options.actions) {
    if (planTools.has(action.tool)) {
      seenPlan = true;
    }
    if (editTools.has(action.tool)) {
      if (!seenEdit) {
        plannedBeforeEditing = seenPlan;
        seenEdit = true;
      }
      if (action.path) {
        files.push(
          normalizeRepoPath({ rawPath: action.path, cwd: options.cwd }),
        );
      }
    }
    if (action.tool === "Bash" && action.command) {
      const step = extractVerificationToken(action.command);
      if (step.length > 0) {
        verificationSteps.push(step);
      }
    }
  }

  return {
    tools,
    verificationSteps: [...new Set(verificationSteps)],
    filesTouched: [...new Set(files)],
    plannedBeforeEditing,
  };
}

export function extractBehaviorFromIndex(options: {
  readonly events: readonly IndexedEvent[];
}): SessionBehavior {
  const tools = [
    ...new Set(
      options.events.flatMap((e) =>
        e.kind === "tool-call" && e.tool?.name ? [e.tool.name] : [],
      ),
    ),
  ];
  let plannedBeforeEditing = false;
  let seenEdit = false;
  let seenPlan = false;

  for (const event of options.events) {
    const toolName = event.tool?.name;
    if (
      event.kind === "plan-presented" ||
      event.kind === "plan-resolved" ||
      (toolName && planTools.has(toolName))
    ) {
      seenPlan = true;
    }
    if (toolName && editTools.has(toolName)) {
      if (!seenEdit) {
        plannedBeforeEditing = seenPlan;
        seenEdit = true;
      }
    }
  }

  return {
    tools,
    verificationSteps: [],
    filesTouched: null,
    plannedBeforeEditing,
  };
}
