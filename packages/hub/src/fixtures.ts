import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CloneNode, CloneStartInput, CloneView } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";
import { nodeLinks, type NodeLinks } from "./fleet/links";
import { createHub } from "./hub";
import { hubStore, type HubStore } from "./store";
import { openHubDatabase } from "./store/database";

export const claudeCallback = "https://claude.ai/api/mcp/auth_callback";

export const issuer = "https://hub.example.ts.net";

export const verifier = "v".repeat(43);

export function fakeNode(started: CloneStartInput[], clones: readonly CloneView[] = []): CloneNode {
  const find = (id: string) => clones.find((clone) => clone.id === id) ?? null;

  return {
    start: async (input) => {
      started.push(input);

      return { kind: "refused", reason: "The fake node starts nothing." };
    },
    send: async () => ({ kind: "refused", reason: "No clone." }),
    answer: async () => ({ kind: "refused", reason: "No clone." }),
    list: async () => ({ clones, unreadable: [] }),
    get: async (id) => find(id),
    stop: async (id) => {
      const clone = find(id);

      return clone === null ? { kind: "unknown" } : { kind: "stopping", clone };
    },
  };
}

export const hubHost = "studio";

export type TestHub = {
  readonly store: HubStore;
  readonly links: NodeLinks;
  readonly started: CloneStartInput[];
  readonly logs: string[];
  readonly advance: (minutes: number) => void;
  readonly call: (options: {
    readonly method?: string;
    readonly path: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string;
    readonly peer?: string;
    readonly upgrade?: (name: string) => boolean;
  }) => Promise<Response>;
  readonly remove: () => Promise<void>;
};

export async function testHub(options: { readonly live?: LiveSessions } = {}): Promise<TestHub> {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-hub-")));
  let now = new Date("2026-10-18T12:00:00Z");
  const store = hubStore({
    database: openHubDatabase(path.join(directory, "hub.db")),
    now: () => now,
  });
  const started: CloneStartInput[] = [];
  const logs: string[] = [];
  const links = nodeLinks({ timeoutMilliseconds: 500 });
  const hub = createHub({
    store,
    node: fakeNode(started),
    hostName: hubHost,
    links,
    log: (line) => logs.push(line),
    ...(options.live === undefined ? {} : { live: options.live }),
  });

  store.setSetting({ key: "publicUrl", value: issuer });

  return {
    store,
    links,
    started,
    logs,
    advance: (minutes) => {
      now = new Date(now.getTime() + minutes * 60_000);
    },
    call: (options) =>
      hub
        .handle({
          request: new Request(`http://127.0.0.1:4517${options.path}`, {
            method: options.method ?? "GET",
            headers: options.headers ?? {},
            ...(options.body === undefined ? {} : { body: options.body }),
          }),
          peer: options.peer ?? "127.0.0.1",
          ...(options.upgrade === undefined ? {} : { upgrade: options.upgrade }),
        })
        .then((response) => response ?? new Response(null, { status: 101 })),
    remove: async () => {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
