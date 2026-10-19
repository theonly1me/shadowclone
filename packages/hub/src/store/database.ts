import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";
import { assertRegularDestination } from "@shadowclone/core";

const schema = [
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL,
    created_at TEXT NOT NULL, approved_at TEXT, last_used_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS pairing_codes (
    hash TEXT PRIMARY KEY, kind TEXT NOT NULL, expires_at TEXT NOT NULL,
    failures INTEGER NOT NULL DEFAULT 0, used_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, state TEXT,
    code_challenge TEXT NOT NULL, scope TEXT NOT NULL, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS grants (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL, scope TEXT NOT NULL,
    created_at TEXT NOT NULL, revoked_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS nodes (
    name TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
    last_seen_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS secrets (
    hash TEXT PRIMARY KEY, kind TEXT NOT NULL, grant_id TEXT NOT NULL, redirect_uri TEXT,
    code_challenge TEXT, expires_at TEXT NOT NULL, used_at TEXT)`,
];

export function openHubDatabase(file: string): Database {
  assertRegularDestination(file);
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  chmodSync(path.dirname(file), 0o700);

  const database = new Database(file, { create: true, strict: true });

  chmodSync(file, 0o600);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA busy_timeout = 5000");

  for (const statement of schema) {
    database.exec(statement);
  }

  return database;
}
