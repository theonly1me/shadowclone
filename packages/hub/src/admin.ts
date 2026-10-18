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

export function pairLines(options: {
  readonly store: HubStore;
  readonly node: boolean;
}): readonly string[] {
  const { store } = options;
  const { code } = store.createPairingCode(options.node ? "node" : "client");
  const publicUrl = store.settings().publicUrl;

  return [
    `Pairing code: ${code}`,
    `It works once, for ${pairingMinutes} minutes, and locks after ${pairingTries} wrong tries.`,
    ...(options.node
      ? [
          `On the other machine, run: shadowclone hub join ${publicUrl ?? "<hub URL>"} --code ${code}`,
        ]
      : [`Connector URL: ${connectorUrl(store)}`]),
    ...(publicUrl === null
      ? [
          "The hub has no public URL yet. Run shadowclone hub expose so that other machines can reach it.",
        ]
      : []),
  ];
}

export function nodeLines(store: HubStore): readonly string[] {
  const nodes = store.listNodes();

  return nodes.length === 0
    ? ["No other machine joined this hub. Run shadowclone hub pair --node to add one."]
    : nodes.map(
        (node) => `${node.name}  joined ${node.createdAt}  last seen ${node.lastSeenAt ?? "never"}`,
      );
}

export function removeNodeLine(options: {
  readonly store: HubStore;
  readonly name: string;
}): string {
  return options.store.removeNode(options.name)
    ? `Removed node ${options.name}. It cannot connect again until it joins with a new code.`
    : `No node ${options.name} joined this hub.`;
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
    `Joined nodes: ${options.store.listNodes().length}`,
  ];
}
