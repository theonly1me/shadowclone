import type { SourceId } from "../config";

export type TextRef = {
  readonly sourcePath: string;
  readonly byteOffset: number;
  readonly byteLength: number;
};

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
