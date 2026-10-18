import type { Database } from "bun:sqlite";
import { hashSecret, newSecret } from "./secret";

export const nodeNamePattern = /^[a-z0-9][a-z0-9-]{0,31}$/;

export type HubNode = {
  readonly name: string;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
};

type NodeRow = { name: string; created_at: string; last_seen_at: string | null };

export function joinNode(options: {
  readonly database: Database;
  readonly now: Date;
  readonly name: string;
}): string {
  const token = newSecret();

  options.database
    .query(
      `INSERT INTO nodes (name, token_hash, created_at) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at`,
    )
    .run(options.name, hashSecret(token), options.now.toISOString());

  return token;
}

export function authenticateNode(options: {
  readonly database: Database;
  readonly token: string;
}): string | null {
  return (
    options.database
      .query<{ name: string }, [string]>("SELECT name FROM nodes WHERE token_hash = ?")
      .get(hashSecret(options.token))?.name ?? null
  );
}

export function listNodes(database: Database): readonly HubNode[] {
  return database
    .query<NodeRow, []>("SELECT name, created_at, last_seen_at FROM nodes ORDER BY name")
    .all()
    .map((row) => ({ name: row.name, createdAt: row.created_at, lastSeenAt: row.last_seen_at }));
}

export function removeNode(options: {
  readonly database: Database;
  readonly name: string;
}): boolean {
  return options.database.query("DELETE FROM nodes WHERE name = ?").run(options.name).changes > 0;
}

export function touchNode(options: {
  readonly database: Database;
  readonly name: string;
  readonly now: Date;
}): void {
  options.database
    .query("UPDATE nodes SET last_seen_at = ? WHERE name = ?")
    .run(options.now.toISOString(), options.name);
}
