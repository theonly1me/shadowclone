import { acquireLocalLock } from "@shadowclone/core";
import type { CloneNode } from "@shadowclone/clones";
import { hubHostName } from "./fleet/hostName";
import { nodeLinks, type NodeSocket } from "./fleet/links";
import { nodeProtocol } from "./fleet/protocol";
import { createHub } from "./hub";
import type { HubPaths } from "./paths";
import { hubStore, type HubStore } from "./store";
import { openHubDatabase } from "./store/database";
import { issuerOf } from "./store/settings";

const maximumRequestBody = 262_144;

type LinkData = { readonly name: string; socket?: NodeSocket };

export function startHubServer(options: {
  readonly store: HubStore;
  readonly node: CloneNode;
  readonly port: number;
  readonly log: (line: string) => void;
  readonly hostName?: string;
}) {
  const { store, log } = options;
  const links = nodeLinks();
  const hub = createHub({
    store,
    node: options.node,
    hostName: options.hostName ?? hubHostName(),
    links,
    log,
  });

  return Bun.serve<LinkData>({
    hostname: "127.0.0.1",
    port: options.port,
    maxRequestBodySize: maximumRequestBody,
    fetch: (request, server) =>
      hub.handle({
        request,
        peer: server.requestIP(request)?.address ?? null,
        upgrade: (name) =>
          server.upgrade(request, {
            data: { name },
            headers: { "Sec-WebSocket-Protocol": nodeProtocol },
          }),
      }),
    websocket: {
      open: (socket) => {
        const link: NodeSocket = {
          send: (text) => {
            socket.send(text);
          },
          close: () => socket.close(),
        };

        socket.data.socket = link;
        links.connect({ name: socket.data.name, socket: link });
        store.touchNode(socket.data.name);
        log(`Node ${socket.data.name} connected.`);
      },
      message: (socket, message) => {
        links.receive({ name: socket.data.name, text: String(message) });
      },
      close: (socket) => {
        if (socket.data.socket !== undefined) {
          links.disconnect({ name: socket.data.name, socket: socket.data.socket });
        }

        store.touchNode(socket.data.name);
        log(`Node ${socket.data.name} disconnected.`);
      },
    },
  });
}

export async function serveHub(options: {
  readonly paths: HubPaths;
  readonly node: CloneNode;
  readonly port?: number;
  readonly signal: AbortSignal;
  readonly log: (line: string) => void;
}): Promise<"stopped" | "already-running"> {
  const lock = await acquireLocalLock(options.paths.lockFile);

  if (lock === null) {
    return "already-running";
  }

  const store = hubStore({
    database: openHubDatabase(options.paths.database),
    now: () => new Date(),
  });

  if (options.port !== undefined) {
    store.setSetting({ key: "port", value: String(options.port) });
  }

  const settings = store.settings();
  const server = startHubServer({
    store,
    node: options.node,
    port: settings.port,
    log: options.log,
  });

  options.log(`The hub listens on http://127.0.0.1:${settings.port}.`);
  options.log(`Connector URL: ${issuerOf(settings)}/mcp`);

  await new Promise<void>((resolve) => {
    if (options.signal.aborted) {
      resolve();
    }

    options.signal.addEventListener("abort", () => resolve(), { once: true });
  });

  await server.stop(true);
  store.close();
  lock.release();

  return "stopped";
}
