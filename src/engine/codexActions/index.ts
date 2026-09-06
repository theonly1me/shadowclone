import { redactSecrets } from "../../redact";
import type { EngineAction } from "../types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveItemSuccess(status: unknown): boolean | null {
  if (status === "failed") {
    return false;
  }
  if (status === "completed") {
    return true;
  }
  return null;
}

export function codexActions(
  item: Record<string, unknown>,
): readonly EngineAction[] {
  const itemType = item.type ?? item.item_type;
  const succeeded = resolveItemSuccess(item.status);

  if (itemType === "command_execution" && typeof item.command === "string") {
    const exitCodeSuccess =
      typeof item.exit_code === "number" ? item.exit_code === 0 : succeeded;

    return [
      {
        tool: "Bash",
        path: null,
        command: redactSecrets({ text: item.command }),
        succeeded: exitCodeSuccess,
      },
    ];
  }

  if (itemType === "file_change" && Array.isArray(item.changes)) {
    return item.changes.flatMap((change) => {
      if (!isRecord(change) || typeof change.path !== "string") {
        return [];
      }

      return [
        {
          tool: "Edit",
          path: redactSecrets({ text: change.path }),
          succeeded,
        },
      ];
    });
  }

  if (itemType === "plan" || itemType === "todo_list") {
    return [
      {
        tool: "Plan",
        path: null,
        succeeded,
      },
    ];
  }

  return [];
}
