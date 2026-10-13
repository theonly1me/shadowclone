import type { Database } from "bun:sqlite";
import type { AgentEvent, AgentEventKind, ToolCall } from "../../types";
import type { OpencodeSession } from "./sessions";

type PartRow = {
  readonly messageId: string;
  readonly createdAt: number;
  readonly role: string | null;
  readonly errorName: string | null;
  readonly partId: string | null;
  readonly partType: string | null;
  readonly synthetic: number | null;
  readonly ignored: number | null;
  readonly tool: string | null;
  readonly callId: string | null;
  readonly toolStatus: string | null;
  readonly textBytes: number | null;
};

export type OpencodeEventDraft = {
  readonly eventId: string;
  readonly timestamp: number;
  readonly kind: AgentEventKind;
  readonly tool: ToolCall | null;
  readonly isError: boolean;
  readonly textRef: AgentEvent["textRef"];
  readonly textBytes: number;
};

function isTypedText(row: PartRow): boolean {
  return (
    row.partType === "text" && (row.textBytes ?? 0) > 0 && row.synthetic !== 1 && row.ignored !== 1
  );
}

function partEvent(options: {
  readonly row: PartRow;
  readonly partId: string;
  readonly sourcePath: string;
}): OpencodeEventDraft | null {
  const { row } = options;
  const base = { eventId: options.partId, timestamp: row.createdAt, tool: null, isError: false };
  const textBytes = row.textBytes ?? 0;
  const textRef = {
    type: "sqlite-row" as const,
    sourcePath: options.sourcePath,
    table: "part" as const,
    rowId: options.partId,
    jsonPath: ["text"],
  };

  if (isTypedText(row) && row.role === "user") {
    return { ...base, kind: "user-prompt", textRef, textBytes };
  }

  if (isTypedText(row) && row.role === "assistant") {
    return { ...base, kind: "assistant-text", textRef, textBytes };
  }

  if (row.partType === "reasoning" && row.role === "assistant") {
    return { ...base, kind: "thinking", textRef: null, textBytes: 0 };
  }

  if (row.partType === "tool" && row.role === "assistant" && row.tool !== null) {
    return {
      ...base,
      kind: "tool-call",
      tool: { toolUseId: row.callId, name: row.tool },
      isError: row.toolStatus === "error",
      textRef: null,
      textBytes: 0,
    };
  }

  return null;
}

function interruption(row: PartRow): OpencodeEventDraft | null {
  return row.role === "assistant" && row.errorName === "MessageAbortedError"
    ? {
        eventId: `${row.messageId}:interrupted`,
        timestamp: row.createdAt,
        kind: "interruption",
        tool: null,
        isError: true,
        textRef: null,
        textBytes: 0,
      }
    : null;
}

export function readVersionOneEvents(options: {
  readonly database: Database;
  readonly session: OpencodeSession;
  readonly sourcePath: string;
}): readonly OpencodeEventDraft[] {
  const rows = options.database
    .query<PartRow, [string, number]>(
      `SELECT m.id AS messageId, m.time_created AS createdAt,
         json_extract(m.data, '$.role') AS role,
         json_extract(m.data, '$.error.name') AS errorName,
         p.id AS partId,
         json_extract(p.data, '$.type') AS partType,
         json_extract(p.data, '$.synthetic') AS synthetic,
         json_extract(p.data, '$.ignored') AS ignored,
         json_extract(p.data, '$.tool') AS tool,
         json_extract(p.data, '$.callID') AS callId,
         json_extract(p.data, '$.state.status') AS toolStatus,
         length(CAST(json_extract(p.data, '$.text') AS BLOB)) AS textBytes
       FROM message m LEFT JOIN part p ON p.message_id = m.id
       WHERE m.session_id = ? AND m.time_created >= ?
       ORDER BY m.time_created, m.id, p.id`,
    )
    .all(options.session.id, options.session.createdAt);
  const events: OpencodeEventDraft[] = [];

  rows.forEach((row, index) => {
    const event =
      row.partId === null
        ? null
        : partEvent({ row, partId: row.partId, sourcePath: options.sourcePath });

    if (event !== null) {
      events.push(event);
    }

    const closesMessage = rows[index + 1]?.messageId !== row.messageId;
    const interrupted = closesMessage ? interruption(row) : null;

    if (interrupted !== null) {
      events.push(interrupted);
    }
  });

  return events;
}
