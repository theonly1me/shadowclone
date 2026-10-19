import { acquireLocalLock } from "@shadowclone/core";
import type { CloneNode } from "@shadowclone/clones";
import { createHub } from "./hub";
import type { HubPaths } from "./paths";
import { hubStore } from "./store";
import { openHubDatabase } from "./store/database";
import { issuerOf } from "./store/settings";

const maximumRequestBody = 262_144;

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
  const hub = createHub({ store, node: options.node, log: options.log });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: settings.port,
    maxRequestBodySize: maximumRequestBody,
    fetch: (request, current) =>
      hub.handle({ request, peer: current.requestIP(request)?.address ?? null }),
  });

  options.log(`The hub listens on http://127.0.0.1:${settings.port}.`);
  options.log(`Connector URL: ${issuerOf(settings)}/mcp`);

  await new Promise<void>((resolve) => {
    if (options.signal.aborted) {
      resolve();
    }

    options.signal.addEventListener("abort", () => resolve(), { once: true });
  });

  await server.stop();
  store.close();
  lock.release();

  return "stopped";
}
