import type { SourceId } from "../config";

export type FileTextRef = {
  readonly type: "file";
  readonly sourcePath: string;
  readonly byteOffset: number;
  readonly byteLength: number;
};

export type SqliteTextRef = {
  readonly type: "sqlite-blob";
  readonly sourcePath: string;
  readonly blobId: string;
  readonly jsonPath: readonly (string | number)[];
  readonly unwrap: "user-query" | null;
};

export type TextRef = FileTextRef | SqliteTextRef;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTextRef(value: unknown): TextRef | null {
  if (!isRecord(value) || typeof value.sourcePath !== "string") {
    return null;
  }
  if (
    value.type === "file" &&
    typeof value.byteOffset === "number" &&
    typeof value.byteLength === "number"
  ) {
    return {
      type: "file",
      sourcePath: value.sourcePath,
      byteOffset: value.byteOffset,
      byteLength: value.byteLength,
    };
  }
  if (
    value.type !== "sqlite-blob" ||
    typeof value.blobId !== "string" ||
    !Array.isArray(value.jsonPath) ||
    !value.jsonPath.every(
      (part) => typeof part === "string" || typeof part === "number",
    ) ||
    (value.unwrap !== null && value.unwrap !== "user-query")
  ) {
    return null;
  }
  return {
    type: "sqlite-blob",
    sourcePath: value.sourcePath,
    blobId: value.blobId,
    jsonPath: value.jsonPath,
    unwrap: value.unwrap,
  };
}

export function textRefKey(ref: TextRef): string {
  return JSON.stringify(ref);
}

export type FileCursor = {
  readonly sourcePath: string;
  readonly byteSize: number;
  readonly modifiedAt: number;
  readonly byteOffset: number;
};

export type ToolCall = {
  readonly toolUseId: string | null;
  readonly name: string;
};

export type AgentEventKind =
  | "user-prompt"
  | "assistant-text"
  | "thinking"
  | "tool-call"
  | "tool-result"
  | "plan-presented"
  | "plan-resolved"
  | "question-asked"
  | "question-answered"
  | "permission-denied"
  | "interruption"
  | "session-end";

export type AgentEvent = {
  readonly source: SourceId;
  readonly sessionId: string;
  readonly eventId: string;
  readonly parentEventId: string | null;
  readonly timestamp: number;
  readonly cwd: string;
  readonly gitBranch: string | null;
  readonly kind: AgentEventKind;
  readonly tool: ToolCall | null;
  readonly isError: boolean;
  readonly textRef: TextRef | null;
};

export type ObservationBatch = {
  readonly source: SourceId;
  readonly sourcePath: string;
  readonly events: readonly AgentEvent[];
  readonly cursor: FileCursor;
  readonly rescanned: boolean;
  readonly bytesRead: number;
};

export type CursorLookup = (
  sourcePath: string,
) => FileCursor | null | Promise<FileCursor | null>;
