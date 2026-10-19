import type { Database } from "bun:sqlite";
import {
  findClient,
  listClients,
  markClient,
  registerClient,
  revokeClient,
  type HubClient,
} from "./clients";
import { createConsent, findConsent, removeConsent, type Consent } from "./consents";
import { createPairingCode, redeemPairingCode, type PairingKind } from "./pairing";
import { readSettings, writeSetting, type HubSettings, type SettingKey } from "./settings";
import { authenticate, exchangeCode, issueCode, refreshTokens, type TokenOutcome } from "./tokens";

export type HubStore = {
  readonly settings: () => HubSettings;
  readonly setSetting: (options: {
    readonly key: SettingKey;
    readonly value: string | null;
  }) => void;
  readonly registerClient: (options: {
    readonly name: string;
    readonly redirectUris: readonly string[];
  }) => HubClient | null;
  readonly findClient: (id: string) => HubClient | null;
  readonly listClients: () => readonly HubClient[];
  readonly revokeClient: (id: string) => boolean;
  readonly createPairingCode: (kind: PairingKind) => {
    readonly code: string;
    readonly expiresAt: string;
  };
  readonly redeemPairingCode: (options: {
    readonly kind: PairingKind;
    readonly code: string;
  }) => boolean;
  readonly createConsent: (consent: Omit<Consent, "id">) => string;
  readonly findConsent: (id: string) => Consent | null;
  readonly removeConsent: (id: string) => void;
  readonly approveConsent: (consent: Consent) => string;
  readonly exchangeCode: (options: {
    readonly code: string;
    readonly clientId: string;
    readonly redirectUri: string;
    readonly verifier: string;
  }) => TokenOutcome;
  readonly refreshTokens: (options: {
    readonly refreshToken: string;
    readonly clientId: string;
  }) => TokenOutcome;
  readonly authenticate: (accessToken: string) => { readonly clientId: string } | null;
  readonly close: () => void;
};

export function hubStore(options: {
  readonly database: Database;
  readonly now: () => Date;
}): HubStore {
  const { database, now } = options;

  return {
    settings: () => readSettings(database),
    setSetting: (setting) => writeSetting({ database, ...setting }),
    registerClient: (client) => registerClient({ database, now: now(), ...client }),
    findClient: (id) => findClient({ database, id }),
    listClients: () => listClients(database),
    revokeClient: (id) => revokeClient({ database, id, now: now() }),
    createPairingCode: (kind) => createPairingCode({ database, now: now(), kind }),
    redeemPairingCode: (pairing) => redeemPairingCode({ database, now: now(), ...pairing }),
    createConsent: (consent) => createConsent({ database, now: now(), consent }),
    findConsent: (id) => findConsent({ database, now: now(), id }),
    removeConsent: (id) => removeConsent({ database, id }),
    approveConsent: (consent) =>
      database.transaction(() => {
        const at = now();

        markClient({ database, id: consent.clientId, column: "approved_at", now: at });
        removeConsent({ database, id: consent.id });

        return issueCode({
          database,
          now: at,
          clientId: consent.clientId,
          scope: consent.scope,
          redirectUri: consent.redirectUri,
          codeChallenge: consent.codeChallenge,
        });
      })(),
    exchangeCode: (exchange) => exchangeCode({ database, now: now(), ...exchange }),
    refreshTokens: (refresh) => refreshTokens({ database, now: now(), ...refresh }),
    authenticate: (accessToken) => {
      const at = now();
      const caller = authenticate({ database, now: at, accessToken });

      if (caller !== null) {
        markClient({ database, id: caller.clientId, column: "last_used_at", now: at });
      }

      return caller;
    },
    close: () => database.close(),
  };
}
