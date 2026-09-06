import type { EngineRun } from "./types";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function parseStructured(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseCodexStream(options: {
  readonly stream: string;
  readonly fallbackSessionId: string;
  readonly durationMs: number;
}): EngineRun {
  let sessionId = options.fallbackSessionId;
  let text = "";
  let turns = 0;
  let isError = false;

  for (const line of options.stream.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      isError = true;
      continue;
    }
    if (!isRecord(event)) {
      continue;
    }
    const type = readString(event, "type");
    if (type === "thread.started") {
      sessionId = readString(event, "thread_id") ?? sessionId;
    }
    if (type === "turn.completed") {
      turns += 1;
    }
    if (type === "turn.failed" || type === "error") {
      isError = true;
    }
    const item = isRecord(event.item) ? event.item : null;
    const itemType = item
      ? readString(item, "item_type") ?? readString(item, "type")
      : null;
    if (
      type === "item.completed" &&
      item !== null &&
      (itemType === "assistant_message" || itemType === "agent_message")
    ) {
      text = readString(item, "text") ?? text;
    }
  }

  return {
    engine: "codex",
    sessionId,
    transcriptPath: null,
    text,
    structured: parseStructured(text),
    costUsd: null,
    durationMs: options.durationMs,
    turns,
    isError,
    permissionDenials: [],
    actions: [],
    errorMessage: null,
  };
}
