import type { Database } from "bun:sqlite";
import { z } from "zod";

export const defaultHubPort = 4517;

const settingsSchema = z.object({
  port: z.coerce.number().int().min(1).max(65_535).default(defaultHubPort),
  publicUrl: z.string().optional(),
  locked: z.enum(["yes", "no"]).default("no"),
  allow: z.string().default("[]"),
});

export type HubSettings = {
  readonly port: number;
  readonly publicUrl: string | null;
  readonly locked: boolean;
  readonly allow: readonly string[];
};

export type SettingKey = "port" | "publicUrl" | "locked" | "allow";

export function readSettings(database: Database): HubSettings {
  const rows = database
    .query<{ key: string; value: string }, []>("SELECT key, value FROM settings")
    .all();
  const settings = settingsSchema.parse(
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  );

  return {
    port: settings.port,
    publicUrl: settings.publicUrl ?? null,
    locked: settings.locked === "yes",
    allow: z.array(z.string()).parse(JSON.parse(settings.allow)),
  };
}

export function writeSetting(options: {
  readonly database: Database;
  readonly key: SettingKey;
  readonly value: string | null;
}): void {
  if (options.value === null) {
    options.database.query("DELETE FROM settings WHERE key = ?").run(options.key);
    return;
  }

  options.database
    .query(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(options.key, options.value);
}

export function issuerOf(settings: HubSettings): string {
  return settings.publicUrl ?? `http://127.0.0.1:${settings.port}`;
}
