import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ShadowcloneConfig } from "../config";
import { observeAll } from "../observe";
import type {
  FileCursor,
  ObservationBatch,
} from "../observe";
import type { ProjectPaths } from "../paths";
import { createSchema } from "./schema";

type CursorRow = {
  readonly source_path: string;
  readonly byte_size: number;
  readonly modified_at: number;
  readonly byte_offset: number;
};

export type IngestSummary = {
  readonly files: number;
  readonly events: number;
  readonly sessions: number;
  readonly bytesRead: number;
  readonly rescannedFiles: number;
};

export class EventIndex {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
    createSchema(database);
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
    const save = this.#database.transaction(
      (observationBatch: ObservationBatch) => {
        if (observationBatch.rescanned) {
          this.#database
            .query<void, [string]>(
              "DELETE FROM events WHERE source_path = ?",
            )
            .run(observationBatch.sourcePath);
        }

        const insert = this.#database.query<
          void,
          [
            string,
            string,
            string,
            string,
            string | null,
            number,
            string,
            string | null,
            string,
            string | null,
            string | null,
            number,
            number | null,
            number | null,
          ]
        >(
          `INSERT INTO events (
            source_path, source, session_id, event_id, parent_event_id,
            timestamp, cwd, git_branch, kind, tool_use_id, tool_name,
            is_error, text_byte_offset, text_byte_length
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );

        for (const event of observationBatch.events) {
          insert.run(
            observationBatch.sourcePath,
            event.source,
            event.sessionId,
            event.eventId,
            event.parentEventId,
            event.timestamp,
            event.cwd,
            event.gitBranch,
            event.kind,
            event.tool?.toolUseId ?? null,
            event.tool?.name ?? null,
            event.isError ? 1 : 0,
            event.textRef?.byteOffset ?? null,
            event.textRef?.byteLength ?? null,
          );
        }

        this.#database
          .query<
            void,
            [string, string, number, number, number]
          >(
            `INSERT INTO cursors (
              source_path, source, byte_size, modified_at, byte_offset
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(source_path) DO UPDATE SET
              source = excluded.source,
              byte_size = excluded.byte_size,
              modified_at = excluded.modified_at,
              byte_offset = excluded.byte_offset`,
          )
          .run(
            observationBatch.sourcePath,
            observationBatch.source,
            observationBatch.cursor.byteSize,
            observationBatch.cursor.modifiedAt,
            observationBatch.cursor.byteOffset,
          );
      },
    );

    save(batch);
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
    const row = this.#database
      .query<{ readonly count: number }, []>(
        `SELECT COUNT(*) AS count FROM (
          SELECT DISTINCT source, session_id FROM events
        )`,
      )
      .get();
    return row?.count ?? 0;
  }

  close(): void {
    this.#database.close();
  }
}

export async function openEventIndex(databasePath: string): Promise<EventIndex> {
  await mkdir(path.dirname(databasePath), { recursive: true });
  return new EventIndex(new Database(databasePath, { create: true }));
}

export async function ingestSources(options: {
  readonly index: EventIndex;
  readonly config: ShadowcloneConfig;
  readonly paths: ProjectPaths;
}): Promise<IngestSummary> {
  let files = 0;
  let events = 0;
  let bytesRead = 0;
  let rescannedFiles = 0;

  for await (const batch of observeAll({
    config: options.config,
    paths: options.paths,
    getCursor: (sourcePath) => options.index.getCursor(sourcePath),
  })) {
    options.index.saveBatch(batch);
    files += 1;
    events += batch.events.length;
    bytesRead += batch.bytesRead;
    rescannedFiles += batch.rescanned ? 1 : 0;
  }

  return {
    files,
    events,
    sessions: options.index.countSessions(),
    bytesRead,
    rescannedFiles,
  };
}
