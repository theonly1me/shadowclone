import { Database } from "bun:sqlite";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths, defaultConfig, type ProjectPaths } from "@shadowclone/core";
import { observeAll } from "../../index";
import { resolveRedacted } from "../../redacted";
import { captureRoots } from "../../roots";
import type { AgentEvent, CursorLookup, ObservationBatch } from "../../types";

export const plantedSecret = ["sk", "proj", "opencode123DEF456ghi789"].join("-");

export async function opencodeFixture(): Promise<{
  readonly paths: ProjectPaths;
  readonly database: Database;
}> {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-opencode-"));
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });

  await mkdir(paths.opencodeDataDirectory, { recursive: true });

  return {
    paths,
    database: new Database(paths.opencodeDatabaseFile, { create: true, strict: true }),
  };
}

export function createVersionOneTables(database: Database): void {
  database.exec(`
    CREATE TABLE session (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT,
      directory TEXT NOT NULL, title TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL);
    CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL);
  `);
}

export function createVersionTwoTables(database: Database): void {
  database.exec(`
    CREATE TABLE session_v2 (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT,
      fork_session_id TEXT, directory TEXT NOT NULL, title TEXT, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL);
    CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL,
      seq INTEGER NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL);
  `);
}

export function insertSession(options: {
  readonly database: Database;
  readonly table: "session" | "session_v2";
  readonly id: string;
  readonly createdAt: number;
  readonly parentId?: string;
}): void {
  options.database
    .query<void, [string, string | null, number, number]>(
      `INSERT INTO ${options.table} (id, project_id, parent_id, directory, title, time_created, time_updated)
       VALUES (?, 'project', ?, '/work/repository', 'Session', ?, ?)`,
    )
    .run(options.id, options.parentId ?? null, options.createdAt, options.createdAt);
}

export function insertVersionOneMessage(options: {
  readonly database: Database;
  readonly id: string;
  readonly sessionId: string;
  readonly createdAt: number;
  readonly data: unknown;
  readonly parts: readonly { readonly id: string; readonly data: unknown }[];
}): void {
  options.database
    .query<void, [string, string, number, number, string]>(
      "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      options.id,
      options.sessionId,
      options.createdAt,
      options.createdAt,
      JSON.stringify(options.data),
    );

  for (const part of options.parts) {
    options.database
      .query<void, [string, string, string, number, number, string]>(
        `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        part.id,
        options.id,
        options.sessionId,
        options.createdAt,
        options.createdAt,
        JSON.stringify(part.data),
      );
  }
}

export function insertVersionTwoMessage(options: {
  readonly database: Database;
  readonly id: string;
  readonly sessionId: string;
  readonly type: string;
  readonly seq: number;
  readonly createdAt: number;
  readonly data: unknown;
}): void {
  options.database
    .query<void, [string, string, string, number, number, number, string]>(
      `INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      options.id,
      options.sessionId,
      options.type,
      options.seq,
      options.createdAt,
      options.createdAt,
      JSON.stringify(options.data),
    );
}

export async function observeOpencode(options: {
  readonly paths: ProjectPaths;
  readonly getCursor?: CursorLookup;
}): Promise<readonly ObservationBatch[]> {
  const batches: ObservationBatch[] = [];

  for await (const batch of observeAll({
    config: { ...defaultConfig, sources: { ...defaultConfig.sources, opencode: true } },
    paths: options.paths,
    getCursor: options.getCursor ?? (() => null),
  })) {
    batches.push(batch);
  }

  return batches;
}

export async function learningTexts(options: {
  readonly paths: ProjectPaths;
  readonly events: readonly AgentEvent[];
}): Promise<readonly string[]> {
  const texts: string[] = [];

  for (const event of options.events) {
    if (event.textRef !== null) {
      texts.push(
        `${event.kind}: ${await resolveRedacted({ ref: event.textRef, roots: captureRoots(options.paths) })}`,
      );
    }
  }

  return texts;
}
