import { acquireLocalLock } from "@shadowclone/core";
import type { HubPaths } from "./paths";
import { hubStore, type HubStore } from "./store";
import { openHubDatabase } from "./store/database";
import { pairingMinutes, pairingTries } from "./store/pairing";
import { issuerOf } from "./store/settings";
import { namedSources, validSource } from "./http/source";

export function openHub(paths: HubPaths): HubStore {
  return hubStore({ database: openHubDatabase(paths.database), now: () => new Date() });
}

export function connectorUrl(store: HubStore): string {
  return `${issuerOf(store.settings())}/mcp`;
}

export function pairLines(store: HubStore): readonly string[] {
  const { code } = store.createPairingCode("client");

  return [
    `Pairing code: ${code}`,
    `It works once, for ${pairingMinutes} minutes, and locks after ${pairingTries} wrong tries.`,
    `Connector URL: ${connectorUrl(store)}`,
    ...(store.settings().publicUrl === null
      ? [
          "The hub has no public URL yet. Run shadowclone hub expose to reach it from the Claude app.",
        ]
      : []),
  ];
}

export function clientLines(store: HubStore): readonly string[] {
  const clients = store.listClients();

  return clients.length === 0
    ? ["No connected clients."]
    : clients.map((client) =>
        [
          client.id,
          client.name,
          client.redirectUris.map((uri) => new URL(uri).host).join(","),
          client.lastUsedAt ?? "never used",
        ].join("  "),
      );
}

export function revokeLine(options: { readonly store: HubStore; readonly id: string }): string {
  return options.store.revokeClient(options.id)
    ? `Revoked client ${options.id}. Its tokens stop working now.`
    : `No client ${options.id} exists. Run shadowclone hub clients to list them.`;
}

export function lockLine(options: { readonly store: HubStore; readonly locked: boolean }): string {
  options.store.setSetting({ key: "locked", value: options.locked ? "yes" : "no" });

  return options.locked
    ? "The hub is locked. It refuses every request until you run shadowclone hub unlock."
    : "The hub is unlocked.";
}

export function allowLine(options: {
  readonly store: HubStore;
  readonly entries: readonly string[];
}): string {
  const invalid = options.entries.filter((entry) => !validSource(entry));

  if (invalid.length > 0) {
    throw new Error(
      `Use ${Object.keys(namedSources).join(", ")}, or an address range such as 203.0.113.0/24. Not valid: ${invalid.join(", ")}`,
    );
  }

  options.store.setSetting({ key: "allow", value: JSON.stringify(options.entries) });

  return options.entries.length === 0
    ? "The hub accepts requests from any address."
    : `The hub accepts requests only from ${options.entries.join(", ")}.`;
}

export async function statusLines(options: {
  readonly store: HubStore;
  readonly paths: HubPaths;
}): Promise<readonly string[]> {
  const settings = options.store.settings();
  const lock = await acquireLocalLock(options.paths.lockFile);

  lock?.release();

  return [
    `Hub: ${lock === null ? "running" : "not running"} on http://127.0.0.1:${settings.port}`,
    `Connector URL: ${connectorUrl(options.store)}`,
    `Public URL: ${settings.publicUrl ?? "none. Run shadowclone hub expose"}`,
    `Locked: ${settings.locked ? "yes" : "no"}`,
    `Allowed sources: ${settings.allow.length === 0 ? "any" : settings.allow.join(", ")}`,
    `Connected clients: ${options.store.listClients().length}`,
  ];
}
