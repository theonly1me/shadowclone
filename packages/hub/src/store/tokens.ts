import type { Database } from "bun:sqlite";
import { findSecret, later, revokeGrant, storeSecret, type SecretRow } from "./grantSecrets";
import { newIdentifier, pkceChallenge, sameText } from "./secret";

export const accessSeconds = 3600;

const refreshDays = 30;

const codeSeconds = 300;

export type TokenSet = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly scope: string;
};

export type TokenOutcome =
  | { readonly kind: "issued"; readonly tokens: TokenSet }
  | { readonly kind: "refused"; readonly reason: string };

function issueTokens(options: {
  readonly database: Database;
  readonly now: Date;
  readonly grantId: string;
  readonly scope: string;
}): TokenSet {
  return {
    accessToken: storeSecret({
      ...options,
      kind: "access",
      expiresAt: later({ now: options.now, seconds: accessSeconds }),
    }),
    refreshToken: storeSecret({
      ...options,
      kind: "refresh",
      expiresAt: later({ now: options.now, seconds: refreshDays * 86_400 }),
    }),
    scope: options.scope,
  };
}

export function issueCode(options: {
  readonly database: Database;
  readonly now: Date;
  readonly clientId: string;
  readonly scope: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
}): string {
  const grantId = newIdentifier();

  options.database
    .query("INSERT INTO grants (id, client_id, scope, created_at) VALUES (?, ?, ?, ?)")
    .run(grantId, options.clientId, options.scope, options.now.toISOString());

  return storeSecret({
    database: options.database,
    kind: "code",
    grantId,
    expiresAt: later({ now: options.now, seconds: codeSeconds }),
    code: { redirectUri: options.redirectUri, codeChallenge: options.codeChallenge },
  });
}

function redeem(options: {
  readonly database: Database;
  readonly now: Date;
  readonly kind: "code" | "refresh";
  readonly secret: string;
  readonly clientId: string;
  readonly check: (row: SecretRow) => boolean;
}): TokenOutcome {
  const { database, now } = options;

  return database.transaction((): TokenOutcome => {
    const row = findSecret(options);

    if (row === null || row.revoked_at !== null || row.client_id !== options.clientId) {
      return { kind: "refused", reason: "The grant is not valid." };
    }

    if (row.used_at !== null) {
      revokeGrant({ database, grantId: row.grant_id, now });

      return { kind: "refused", reason: "The grant was already used, so the hub revoked it." };
    }

    if (row.expires_at <= now.toISOString() || !options.check(row)) {
      return { kind: "refused", reason: "The grant is not valid." };
    }

    database
      .query("UPDATE secrets SET used_at = ? WHERE hash = ?")
      .run(now.toISOString(), row.hash);

    return {
      kind: "issued",
      tokens: issueTokens({ database, now, grantId: row.grant_id, scope: row.scope }),
    };
  })();
}

export function exchangeCode(options: {
  readonly database: Database;
  readonly now: Date;
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly verifier: string;
}): TokenOutcome {
  return redeem({
    ...options,
    kind: "code",
    secret: options.code,
    check: (row) =>
      row.redirect_uri === options.redirectUri &&
      row.code_challenge !== null &&
      sameText({ left: pkceChallenge(options.verifier), right: row.code_challenge }),
  });
}

export function refreshTokens(options: {
  readonly database: Database;
  readonly now: Date;
  readonly refreshToken: string;
  readonly clientId: string;
}): TokenOutcome {
  return redeem({ ...options, kind: "refresh", secret: options.refreshToken, check: () => true });
}

export function authenticate(options: {
  readonly database: Database;
  readonly now: Date;
  readonly accessToken: string;
}): { readonly clientId: string } | null {
  const row = findSecret({ ...options, kind: "access", secret: options.accessToken });

  return row === null || row.revoked_at !== null || row.expires_at <= options.now.toISOString()
    ? null
    : { clientId: row.client_id };
}
