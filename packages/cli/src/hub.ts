import { clonesPaths, hostProcesses, installService, localNode } from "@shadowclone/clones";
import {
  allowLine,
  clientLines,
  exposeHub,
  hubPaths,
  lockLine,
  openHub,
  pairLines,
  revokeLine,
  serveHub,
  statusLines,
  type HubStore,
} from "@shadowclone/hub";
import path from "node:path";
import { flagValue } from "./cloneOptions";

export const hubUsage =
  "Hub: hub serve [--port <n>]; hub service; hub expose [--url https://host | --off]; hub pair; hub clients [revoke <id>]; hub lock|unlock; hub allow [anthropic|tailnet|loopback|<range>]... | hub allow --any; hub status";

function stopSignal(): AbortSignal {
  const controller = new AbortController();

  process.on("SIGTERM", () => controller.abort());
  process.on("SIGINT", () => controller.abort());

  return controller.signal;
}

function print(lines: readonly string[]): void {
  console.log(lines.join("\n"));
}

async function withStore(run: (store: HubStore) => Promise<void> | void): Promise<void> {
  const store = openHub(hubPaths());

  try {
    await run(store);
  } finally {
    store.close();
  }
}

function portFlag(arguments_: readonly string[]): number | undefined {
  const value = flagValue({ arguments: arguments_, flag: "--port" });

  if (value === null) {
    return undefined;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--port needs a number from 1 to 65535.");
  }

  return port;
}

const operations: Readonly<Record<string, (arguments_: readonly string[]) => Promise<void>>> = {
  serve: async (arguments_) => {
    const port = portFlag(arguments_);
    const outcome = await serveHub({
      paths: hubPaths(),
      node: localNode({ paths: clonesPaths() }),
      signal: stopSignal(),
      log: (line) => console.log(`${new Date().toISOString()} ${line}`),
      ...(port === undefined ? {} : { port }),
    });

    if (outcome === "already-running") {
      console.log("The hub already runs on this machine.");
      process.exitCode = 1;
    }
  },
  service: async () => {
    const paths = hubPaths();
    const outcome = await installService({
      service: {
        label: "dev.shadowclone.hub",
        unit: "shadowclone-hub.service",
        description: "shadowclone hub",
        command: ["hub", "serve"],
        log: path.join(paths.logsDirectory, "hub.log"),
      },
      processes: hostProcesses,
      executable: Bun.which("shadowclone") ?? "shadowclone",
      pathVariable: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    });

    if (outcome.kind === "installed") {
      print([`The hub runs as a service from ${outcome.file}.`, ...outcome.warnings]);
    } else {
      print([
        outcome.kind === "failed"
          ? outcome.detail
          : `Services do not support ${outcome.platform}. Run shadowclone hub serve.`,
      ]);
      process.exitCode = 1;
    }
  },
  expose: (arguments_) =>
    withStore(async (store) => {
      const url = flagValue({ arguments: arguments_, flag: "--url" });
      const outcome = await exposeHub({
        store,
        processes: hostProcesses,
        ...(url === null ? {} : { url }),
        off: arguments_.includes("--off"),
      });

      if (outcome.kind === "failed") {
        print([outcome.detail]);
        process.exitCode = 1;
      } else {
        print(
          outcome.kind === "hidden"
            ? ["Tailscale Funnel no longer serves the hub."]
            : [
                `Public URL: ${outcome.publicUrl}`,
                `Connector URL: ${outcome.publicUrl}/mcp`,
                "Run shadowclone hub pair, then add the connector URL in Claude.",
              ],
        );
      }
    }),
  pair: () => withStore((store) => print(pairLines(store))),
  clients: (arguments_) =>
    withStore((store) => {
      const [operation, id] = arguments_;

      print(
        operation === "revoke" && id !== undefined
          ? [revokeLine({ store, id })]
          : clientLines(store),
      );
    }),
  lock: () => withStore((store) => print([lockLine({ store, locked: true })])),
  unlock: () => withStore((store) => print([lockLine({ store, locked: false })])),
  allow: (arguments_) =>
    withStore((store) =>
      print([allowLine({ store, entries: arguments_.includes("--any") ? [] : arguments_ })]),
    ),
  status: () => withStore(async (store) => print(await statusLines({ store, paths: hubPaths() }))),
};

export async function hubCommand(arguments_: readonly string[]): Promise<void> {
  const [operation = "", ...rest] = arguments_;
  const handler = operations[operation];

  if (handler === undefined) {
    console.log(hubUsage);
    process.exitCode = operation === "" ? 0 : 1;
    return;
  }

  await handler(rest);
}
