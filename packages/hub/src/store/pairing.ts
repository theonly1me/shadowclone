import type { Database } from "bun:sqlite";
import { hashSecret, newPairingCode, normalPairingCode } from "./secret";

export type PairingKind = "client" | "node";

export const pairingMinutes = 10;

export const pairingTries = 5;

export function createPairingCode(options: {
  readonly database: Database;
  readonly now: Date;
  readonly kind: PairingKind;
}): { readonly code: string; readonly expiresAt: string } {
  const code = newPairingCode();
  const expiresAt = new Date(options.now.getTime() + pairingMinutes * 60_000).toISOString();

  options.database
    .query("DELETE FROM pairing_codes WHERE expires_at < ?")
    .run(options.now.toISOString());
  options.database
    .query("INSERT INTO pairing_codes (hash, kind, expires_at) VALUES (?, ?, ?)")
    .run(hashSecret(normalPairingCode(code)), options.kind, expiresAt);

  return { code, expiresAt };
}

export function redeemPairingCode(options: {
  readonly database: Database;
  readonly now: Date;
  readonly kind: PairingKind;
  readonly code: string;
}): boolean {
  const { database, kind } = options;
  const now = options.now.toISOString();

  return database.transaction(() => {
    const active = `kind = ? AND used_at IS NULL AND expires_at > ? AND failures < ${pairingTries}`;
    const found = database
      .query<{ hash: string }, [string, string, string]>(
        `SELECT hash FROM pairing_codes WHERE hash = ? AND ${active}`,
      )
      .get(hashSecret(normalPairingCode(options.code)), kind, now);

    if (found === null) {
      database
        .query(`UPDATE pairing_codes SET failures = failures + 1 WHERE ${active}`)
        .run(kind, now);

      return false;
    }

    database.query("UPDATE pairing_codes SET used_at = ? WHERE hash = ?").run(now, found.hash);

    return true;
  })();
}
