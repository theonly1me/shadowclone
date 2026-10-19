import type { Database } from "bun:sqlite";
import { hashSecret, newSecret } from "./secret";

export type SecretKind = "code" | "access" | "refresh";

export type SecretRow = {
  grant_id: string;
  redirect_uri: string | null;
  code_challenge: string | null;
  expires_at: string;
  used_at: string | null;
  client_id: string;
  scope: string;
  revoked_at: string | null;
};

export function later(options: { readonly now: Date; readonly seconds: number }): string {
  return new Date(options.now.getTime() + options.seconds * 1000).toISOString();
}

export function storeSecret(options: {
  readonly database: Database;
  readonly kind: SecretKind;
  readonly grantId: string;
  readonly expiresAt: string;
  readonly code?: { readonly redirectUri: string; readonly codeChallenge: string };
}): string {
  const secret = newSecret();

  options.database
    .query(
      `INSERT INTO secrets (hash, kind, grant_id, redirect_uri, code_challenge, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      hashSecret(secret),
      options.kind,
      options.grantId,
      options.code?.redirectUri ?? null,
      options.code?.codeChallenge ?? null,
      options.expiresAt,
    );

  return secret;
}

export function findSecret(options: {
  readonly database: Database;
  readonly kind: SecretKind;
  readonly secret: string;
}): (SecretRow & { readonly hash: string }) | null {
  const hash = hashSecret(options.secret);
  const row = options.database
    .query<SecretRow, [string, string]>(
      `SELECT secrets.grant_id, secrets.redirect_uri, secrets.code_challenge, secrets.expires_at,
        secrets.used_at, grants.client_id, grants.scope, grants.revoked_at
       FROM secrets JOIN grants ON grants.id = secrets.grant_id
       WHERE secrets.hash = ? AND secrets.kind = ?`,
    )
    .get(hash, options.kind);

  return row === null ? null : { ...row, hash };
}

export function revokeGrant(options: {
  readonly database: Database;
  readonly grantId: string;
  readonly now: Date;
}): void {
  options.database
    .query("UPDATE grants SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .run(options.now.toISOString(), options.grantId);
}
