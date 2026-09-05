import type { Database } from "bun:sqlite";
import type { FileCursor, ObservationBatch } from "../observe";
import type {
  CorpusSummary,
  IndexedEvent,
} from "./types";
import { saveObservationBatch } from "./write";

type CursorRow = {
  readonly source_path: string;
  readonly byte_size: number;
  readonly modified_at: number;
  readonly byte_offset: number;
};

type EventRow = {
  readonly id: number;
  readonly source_path: string;
  readonly source: IndexedEvent["source"];
  readonly session_id: string;
  readonly event_id: string;
  readonly parent_event_id: string | null;
  readonly timestamp: number;
  readonly cwd: string;
  readonly git_branch: string | null;
  readonly kind: IndexedEvent["kind"];
  readonly tool_use_id: string | null;
  readonly tool_name: string | null;
  readonly is_error: number;
  readonly text_byte_offset: number | null;
  readonly text_byte_length: number | null;
};

function toIndexedEvent(row: EventRow): IndexedEvent {
  return {
    id: row.id,
    sourcePath: row.source_path,
    source: row.source,
    sessionId: row.session_id,
    eventId: row.event_id,
    parentEventId: row.parent_event_id,
    timestamp: row.timestamp,
    cwd: row.cwd,
    gitBranch: row.git_branch,
    kind: row.kind,
    tool:
      row.tool_name === null
        ? null
        : { toolUseId: row.tool_use_id, name: row.tool_name },
    isError: row.is_error === 1,
    textRef:
      row.text_byte_offset === null || row.text_byte_length === null
        ? null
        : {
            sourcePath: row.source_path,
            byteOffset: row.text_byte_offset,
            byteLength: row.text_byte_length,
          },
  };
}

export class EventIndex {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  getCursor(sourcePath: string): FileCursor | null {
    const row = this.#database
      .query<CursorRow, [string]>(
        `SELECT source_path, byte_size, modified_at, byte_offset
         FROM cursors WHERE source_path = ?`,
      )
      .get(sourcePath);

    return row === null
      ? null
      : {
          sourcePath: row.source_path,
          byteSize: row.byte_size,
          modifiedAt: row.modified_at,
          byteOffset: row.byte_offset,
        };
  }

  saveBatch(batch: ObservationBatch): void {
    saveObservationBatch({ database: this.#database, batch });
  }

  listEvents(): readonly IndexedEvent[] {
    return this.#database
      .query<EventRow, []>(
        `SELECT id, source_path, source, session_id, event_id,
          parent_event_id, timestamp, cwd, git_branch, kind, tool_use_id,
          tool_name, is_error, text_byte_offset, text_byte_length
        FROM events ORDER BY source, session_id, id`,
      )
      .all()
      .map(toIndexedEvent);
  }

  getCorpusSummary(): CorpusSummary {
    const row = this.#database
      .query<CorpusSummary, []>(
        `SELECT
          (SELECT COUNT(*) FROM (
            SELECT DISTINCT source, session_id FROM events
          )) AS sessions,
          COALESCE((SELECT SUM(byte_size) FROM cursors), 0) AS bytes,
          (SELECT COUNT(*) FROM (
            SELECT DISTINCT date(timestamp / 1000, 'unixepoch')
            FROM events WHERE timestamp > 0
          )) AS activeDays`,
      )
      .get();
    return row ?? { sessions: 0, bytes: 0, activeDays: 0 };
  }

  countEvents(): number {
    const row = this.#database
      .query<{ readonly count: number }, []>(
        "SELECT COUNT(*) AS count FROM events",
      )
      .get();
    return row?.count ?? 0;
  }

  countSessions(): number {
    return this.getCorpusSummary().sessions;
  }

  close(): void {
    this.#database.close();
  }
}
