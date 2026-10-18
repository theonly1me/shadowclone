import type { Database } from "bun:sqlite";
import { z } from "zod";
import { newIdentifier } from "./secret";

export type HubClient = {
  readonly id: string;
  readonly name: string;
  readonly redirectUris: readonly string[];
  readonly createdAt: string;
  readonly approvedAt: string | null;
  readonly lastUsedAt: string | null;
};

type ClientRow = {
  id: string;
  name: string;
  redirect_uris: string;
  created_at: string;
  approved_at: string | null;
  last_used_at: string | null;
};

const pendingLimit = 100;
const pendingDays = 1;

function toClient(row: ClientRow): HubClient {
  return {
    id: row.id,
    name: row.name,
    redirectUris: z.array(z.string()).parse(JSON.parse(row.redirect_uris)),
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    lastUsedAt: row.last_used_at,
  };
}

export function registerClient(options: {
  readonly database: Database;
  readonly now: Date;
  readonly name: string;
  readonly redirectUris: readonly string[];
}): HubClient | null {
  const { database, now } = options;
  const staleBefore = new Date(now.getTime() - pendingDays * 86_400_000).toISOString();

  database
    .query("DELETE FROM clients WHERE approved_at IS NULL AND created_at < ?")
    .run(staleBefore);

  const pending = database
    .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM clients WHERE approved_at IS NULL")
    .get();

  if ((pending?.count ?? 0) >= pendingLimit) {
    return null;
  }

  const client: HubClient = {
    id: newIdentifier(),
    name: options.name,
    redirectUris: options.redirectUris,
    createdAt: now.toISOString(),
    approvedAt: null,
    lastUsedAt: null,
  };

  database
    .query("INSERT INTO clients (id, name, redirect_uris, created_at) VALUES (?, ?, ?, ?)")
    .run(client.id, client.name, JSON.stringify(client.redirectUris), client.createdAt);

  return client;
}

export function findClient(options: {
  readonly database: Database;
  readonly id: string;
}): HubClient | null {
  const row = options.database
    .query<ClientRow, [string]>("SELECT * FROM clients WHERE id = ?")
    .get(options.id);

  return row === null ? null : toClient(row);
}

export function listClients(database: Database): readonly HubClient[] {
  return database
    .query<ClientRow, []>("SELECT * FROM clients WHERE approved_at IS NOT NULL ORDER BY created_at")
    .all()
    .map(toClient);
}

export function markClient(options: {
  readonly database: Database;
  readonly id: string;
  readonly column: "approved_at" | "last_used_at";
  readonly now: Date;
}): void {
  const statement =
    options.column === "approved_at"
      ? "UPDATE clients SET approved_at = ? WHERE id = ?"
      : "UPDATE clients SET last_used_at = ? WHERE id = ?";

  options.database.query(statement).run(options.now.toISOString(), options.id);
}

export function revokeClient(options: {
  readonly database: Database;
  readonly id: string;
  readonly now: Date;
}): boolean {
  const { database, id } = options;

  return database.transaction(() => {
    database
      .query("UPDATE grants SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL")
      .run(options.now.toISOString(), id);
    database.query("DELETE FROM consents WHERE client_id = ?").run(id);

    return database.query("DELETE FROM clients WHERE id = ?").run(id).changes > 0;
  })();
}
