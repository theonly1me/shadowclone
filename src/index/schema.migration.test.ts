import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createSchema } from "./schema";

test("version five indexes gain the binding timeline without losing events", () => {
  const database = new Database(":memory:");

  database.exec(`
    CREATE TABLE events (
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
    INSERT INTO events (
      source_path, source, session_id, event_id, timestamp, cwd, kind, is_error
    ) VALUES ('source', 'antigravity', 'session', 'event', 1, '', 'user-prompt', 0);
    PRAGMA user_version = 5;
  `);
  createSchema(database);

  expect(
    database
      .query<{ readonly count: number }, []>(
        "SELECT COUNT(*) AS count FROM events",
      )
      .get()?.count,
  ).toBe(1);
  expect(
    database
      .query<{ readonly name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'origin_binding_timeline'",
      )
      .get()?.name,
  ).toBe("origin_binding_timeline");
  expect(
    database
      .query<{ readonly user_version: number }, []>("PRAGMA user_version")
      .get()?.user_version,
  ).toBe(6);

  database.close();
});
