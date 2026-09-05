import type { Database } from "bun:sqlite";

const schemaVersion = 2;

function resetOutdatedSchema(database: Database): void {
  const version = database
    .query<{ readonly user_version: number }, []>("PRAGMA user_version")
    .get()?.user_version;
  if (version === schemaVersion) {
    return;
  }
  database.exec(`
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS cursors;
  `);
}

export function createSchema(database: Database): void {
  resetOutdatedSchema(database);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cursors (
      source_path TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      modified_at REAL NOT NULL,
      byte_offset INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL,
      source TEXT NOT NULL,
      session_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      parent_event_id TEXT,
      timestamp INTEGER NOT NULL,
      cwd TEXT NOT NULL,
      git_branch TEXT,
      kind TEXT NOT NULL,
      tool_use_id TEXT,
      tool_name TEXT,
      is_error INTEGER NOT NULL,
      text_ref TEXT
    );

    CREATE INDEX IF NOT EXISTS events_source_path
      ON events(source_path);
    CREATE INDEX IF NOT EXISTS events_session
      ON events(source, session_id);
    CREATE INDEX IF NOT EXISTS events_kind
      ON events(kind);

    PRAGMA user_version = ${schemaVersion};
  `);
}
