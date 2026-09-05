import { readJsonLines } from "../cursor";
import {
  isRecord,
  readBoolean,
  readRecord,
  readString,
  readTimestamp,
} from "../record";
import type {
  AgentEvent,
  AgentEventKind,
  FileCursor,
  FileTextRef,
  ObservationBatch,
  ToolCall,
} from "../types";
import {
  getCodexContext,
  type CodexContext,
} from "./codexContext";

function toolFromPayload(
  payload: Readonly<Record<string, unknown>>,
): ToolCall | null {
  const type = readString(payload, "type");
  if (
    type !== "function_call" &&
    type !== "custom_tool_call" &&
    type !== "local_shell_call"
  ) {
    return null;
  }
  return {
    toolUseId: readString(payload, "call_id") ?? readString(payload, "id"),
    name:
      readString(payload, "name") ??
      (type === "local_shell_call" ? "shell" : "unknown"),
  };
}

function responseKind(
  payload: Readonly<Record<string, unknown>>,
): AgentEventKind | null {
  const type = readString(payload, "type");
  const role = readString(payload, "role");
  if (type === "message" && role === "user") {
    return "user-prompt";
  }
  if (type === "message" && role === "assistant") {
    return "assistant-text";
  }
  if (type === "reasoning") {
    return "thinking";
  }
  if (
    type === "function_call_output" ||
    type === "custom_tool_call_output" ||
    type === "local_shell_call_output"
  ) {
    return "tool-result";
  }
  return toolFromPayload(payload) ? "tool-call" : null;
}

function baseEvent(options: {
  readonly context: CodexContext;
  readonly envelope: Readonly<Record<string, unknown>>;
  readonly ref: FileTextRef;
  readonly kind: AgentEventKind;
  readonly tool: ToolCall | null;
}): AgentEvent {
  return {
    source: "codex",
    sessionId: options.context.sessionId,
    eventId: `codex:${options.ref.byteOffset}`,
    parentEventId: null,
    timestamp: readTimestamp(options.envelope.timestamp),
    cwd: options.context.cwd,
    gitBranch: options.context.gitBranch,
    kind: options.kind,
    tool: options.tool,
    isError: false,
    textRef:
      options.kind === "user-prompt" || options.kind === "assistant-text"
        ? options.ref
        : null,
  };
}

function parseRecord(options: {
  readonly value: unknown;
  readonly ref: FileTextRef;
  readonly context: CodexContext;
}): AgentEvent | null {
  if (!isRecord(options.value)) {
    return null;
  }
  const envelopeType = readString(options.value, "type");
  const payload = readRecord(options.value, "payload");
  if (payload === null) {
    return null;
  }
  if (envelopeType === "response_item") {
    const kind = responseKind(payload);
    return kind === null
      ? null
      : baseEvent({
          context: options.context,
          envelope: options.value,
          ref: options.ref,
          kind,
          tool: toolFromPayload(payload),
        });
  }
  const eventType = readString(payload, "type");
  if (
    envelopeType !== "event_msg" ||
    (eventType !== "task_complete" &&
      eventType !== "task_completed" &&
      eventType !== "turn_aborted")
  ) {
    return null;
  }
  const kind = eventType === "turn_aborted" ? "interruption" : "session-end";
  return {
    ...baseEvent({
      context: options.context,
      envelope: options.value,
      ref: options.ref,
      kind,
      tool: null,
    }),
    isError: readBoolean(payload, "is_error"),
  };
}

export async function observeCodexFile(options: {
  readonly sourcePath: string;
  readonly cursor: FileCursor | null;
}): Promise<ObservationBatch | null> {
  const result = await readJsonLines(options);
  if (result === null) {
    return null;
  }
  if (result.values.length === 0) {
    return {
      source: "codex",
      sourcePath: options.sourcePath,
      events: [],
      cursor: result.cursor,
      rescanned: result.rescanned,
      bytesRead: result.bytesRead,
    };
  }
  const context = await getCodexContext({
    sourcePath: options.sourcePath,
    values: result.values,
  });
  let parentEventId: string | null = null;
  const events = result.values.flatMap((line) => {
    const event = parseRecord({ ...line, context });
    if (event === null) {
      return [];
    }
    const chained = { ...event, parentEventId };
    parentEventId = event.eventId;
    return [chained];
  });
  return {
    source: "codex",
    sourcePath: options.sourcePath,
    events,
    cursor: result.cursor,
    rescanned: result.rescanned,
    bytesRead: result.bytesRead,
  };
}

export async function discoverCodexFiles(
  sessionsDirectory: string,
): Promise<readonly string[]> {
  const files: string[] = [];
  for await (const sourcePath of new Bun.Glob("**/rollout-*.jsonl").scan({
    cwd: sessionsDirectory,
    absolute: true,
    onlyFiles: true,
  })) {
    files.push(sourcePath);
  }
  return files.sort();
}
