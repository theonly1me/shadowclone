import {
  isRecord,
  readBoolean,
} from "../record";
import type {
  AgentEvent,
  TextRef,
} from "../types";
import { createClaudeBaseEvent } from "./claudeBase";

function contentContainsMarker(content: unknown, marker: string): boolean {
  if (typeof content === "string") {
    return content.includes(marker);
  }
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some(
    (value) =>
      isRecord(value) &&
      typeof value.content === "string" &&
      value.content.includes(marker),
  );
}

export function parseClaudeUser(options: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly message: Readonly<Record<string, unknown>>;
  readonly ref: TextRef;
}): readonly AgentEvent[] {
  if (readBoolean(options.record, "isMeta")) {
    return [];
  }

  const base = createClaudeBaseEvent(options);
  const content = options.message.content;
  const interrupted = contentContainsMarker(
    content,
    "[Request interrupted by user",
  );
  const denied = contentContainsMarker(
    content,
    "user doesn't want to proceed with this tool use",
  );
  const plainPrompt = typeof content === "string";
  const kind = interrupted
    ? "interruption"
    : denied
      ? "permission-denied"
      : plainPrompt
        ? "user-prompt"
        : "tool-result";

  return [
    {
      ...base,
      kind,
      tool: null,
      isError: readBoolean(options.record, "is_error"),
      textRef: plainPrompt && !interrupted && !denied ? options.ref : null,
    },
  ];
}
