import type { Database } from "bun:sqlite";
import type { OpencodeSession } from "./sessions";
import type { OpencodeEventDraft } from "./versionOneEvents";

type MessageRow = {
  readonly messageId: string;
  readonly type: string;
  readonly createdAt: number;
  readonly outcome: string | null;
  readonly textBytes: number | null;
  readonly contentIndex: number | null;
  readonly contentType: string | null;
  readonly toolId: string | null;
  readonly toolName: string | null;
  readonly toolStatus: string | null;
  readonly contentBytes: number | null;
};

function rowTextRef(options: {
  readonly sourcePath: string;
  readonly rowId: string;
  readonly jsonPath: readonly (string | number)[];
}): OpencodeEventDraft["textRef"] {
  return {
    type: "sqlite-row",
    sourcePath: options.sourcePath,
    table: "session_message",
    rowId: options.rowId,
    jsonPath: options.jsonPath,
  };
}

function contentEvent(options: {
  readonly row: MessageRow;
  readonly contentIndex: number;
  readonly sourcePath: string;
}): OpencodeEventDraft | null {
  const { row, contentIndex } = options;
  const base = {
    eventId: `${row.messageId}:${contentIndex}`,
    timestamp: row.createdAt,
    tool: null,
    isError: false,
  };

  if (row.contentType === "text" && (row.contentBytes ?? 0) > 0) {
    return {
      ...base,
      kind: "assistant-text",
      textBytes: row.contentBytes ?? 0,
      textRef: rowTextRef({
        sourcePath: options.sourcePath,
        rowId: row.messageId,
        jsonPath: ["content", contentIndex, "text"],
      }),
    };
  }

  if (row.contentType === "reasoning") {
    return { ...base, kind: "thinking", textRef: null, textBytes: 0 };
  }

  if (row.contentType === "tool" && row.toolName !== null) {
    return {
      ...base,
      kind: "tool-call",
      tool: { toolUseId: row.toolId, name: row.toolName },
      isError: row.toolStatus === "error",
      textRef: null,
      textBytes: 0,
    };
  }

  return null;
}

function messageEvent(options: {
  readonly row: MessageRow;
  readonly sourcePath: string;
}): OpencodeEventDraft | null {
  const { row } = options;
  const base = { eventId: row.messageId, timestamp: row.createdAt, tool: null };

  if (row.type === "user" && (row.textBytes ?? 0) > 0) {
    return {
      ...base,
      kind: "user-prompt",
      isError: false,
      textBytes: row.textBytes ?? 0,
      textRef: rowTextRef({
        sourcePath: options.sourcePath,
        rowId: row.messageId,
        jsonPath: ["text"],
      }),
    };
  }

  if (row.type === "assistant" && row.contentIndex !== null) {
    return contentEvent({ row, contentIndex: row.contentIndex, sourcePath: options.sourcePath });
  }

  return row.type === "idle" && row.outcome === "interrupted"
    ? { ...base, kind: "interruption", isError: true, textRef: null, textBytes: 0 }
    : null;
}

export function readVersionTwoEvents(options: {
  readonly database: Database;
  readonly session: OpencodeSession;
  readonly sourcePath: string;
}): readonly OpencodeEventDraft[] {
  return options.database
    .query<MessageRow, [string, number]>(
      `SELECT m.id AS messageId, m.type AS type, m.time_created AS createdAt,
         json_extract(m.data, '$.outcome') AS outcome,
         length(CAST(json_extract(m.data, '$.text') AS BLOB)) AS textBytes,
         c.key AS contentIndex,
         json_extract(c.value, '$.type') AS contentType,
         json_extract(c.value, '$.id') AS toolId,
         json_extract(c.value, '$.name') AS toolName,
         json_extract(c.value, '$.state.status') AS toolStatus,
         length(CAST(json_extract(c.value, '$.text') AS BLOB)) AS contentBytes
       FROM session_message m
       LEFT JOIN json_each(m.data, '$.content') c ON m.type = 'assistant'
       WHERE m.session_id = ? AND m.time_created >= ?
       ORDER BY m.seq, c.key`,
    )
    .all(options.session.id, options.session.createdAt)
    .flatMap((row) => {
      const event = messageEvent({ row, sourcePath: options.sourcePath });

      return event === null ? [] : [event];
    });
}
