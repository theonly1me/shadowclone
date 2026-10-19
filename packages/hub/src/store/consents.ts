import type { Database } from "bun:sqlite";
import { newSecret } from "./secret";

export type Consent = {
  readonly id: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string | null;
  readonly codeChallenge: string;
  readonly scope: string;
};

type ConsentRow = {
  id: string;
  client_id: string;
  redirect_uri: string;
  state: string | null;
  code_challenge: string;
  scope: string;
};

const consentMinutes = 10;

export function createConsent(options: {
  readonly database: Database;
  readonly now: Date;
  readonly consent: Omit<Consent, "id">;
}): string {
  const { database, consent } = options;
  const id = newSecret();

  database.query("DELETE FROM consents WHERE expires_at < ?").run(options.now.toISOString());
  database
    .query(
      `INSERT INTO consents (id, client_id, redirect_uri, state, code_challenge, scope, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      consent.clientId,
      consent.redirectUri,
      consent.state,
      consent.codeChallenge,
      consent.scope,
      new Date(options.now.getTime() + consentMinutes * 60_000).toISOString(),
    );

  return id;
}

export function findConsent(options: {
  readonly database: Database;
  readonly now: Date;
  readonly id: string;
}): Consent | null {
  const row = options.database
    .query<ConsentRow, [string, string]>("SELECT * FROM consents WHERE id = ? AND expires_at > ?")
    .get(options.id, options.now.toISOString());

  return row === null
    ? null
    : {
        id: row.id,
        clientId: row.client_id,
        redirectUri: row.redirect_uri,
        state: row.state,
        codeChallenge: row.code_challenge,
        scope: row.scope,
      };
}

export function removeConsent(options: { readonly database: Database; readonly id: string }): void {
  options.database.query("DELETE FROM consents WHERE id = ?").run(options.id);
}
