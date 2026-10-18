import path from "node:path";
import { clonesPaths, hostProcesses, localNode } from "@shadowclone/clones";
import {
  allowLine,
  clientLines,
  exposeHub,
  hubPaths,
  lockLine,
  nodeLines,
  notifyLines,
  pairLines,
  removeNodeLine,
  revokeLine,
  sendNtfy,
  serveHub,
  statusLines,
} from "@shadowclone/hub";
import { machineLive } from "@shadowclone/live";
import { flagValue } from "./cloneOptions";
import { print, runAsService, stopSignal, timestamped, withStore } from "./hubCommon";
import { nodeOperations } from "./hubNode";

export const hubUsage =
  "Hub: hub serve [--port <n>]; hub service; hub expose [--url https://host | --tailnet | --off]; hub pair [--node]; hub clients [revoke <id>]; hub nodes [remove <name>]; hub notify [--url <ntfy topic URL>] [--text | --no-text] [--off] | hub notify test; hub lock|unlock; hub allow [anthropic|tailnet|loopback|<range>]... | hub allow --any; hub status; hub join <hub URL> --code <code> [--name <name>] [--no-service]; hub link; hub leave";

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
      live: machineLive(),
      signal: stopSignal(),
      log: timestamped,
      ...(port === undefined ? {} : { port }),
    });

    if (outcome === "already-running") {
      console.log("The hub already runs on this machine.");
      process.exitCode = 1;
    }
  },
  service: () =>
    runAsService({
      service: {
        label: "dev.shadowclone.hub",
        unit: "shadowclone-hub.service",
        description: "shadowclone hub",
        command: ["hub", "serve"],
        log: path.join(hubPaths().logsDirectory, "hub.log"),
      },
      what: "hub",
    }),
  expose: (arguments_) =>
    withStore(async (store) => {
      const url = flagValue({ arguments: arguments_, flag: "--url" });
      const tailnetOnly = arguments_.includes("--tailnet");
      const outcome = await exposeHub({
        store,
        processes: hostProcesses,
        ...(url === null ? {} : { url }),
        off: arguments_.includes("--off"),
        tailnetOnly,
      });

      if (outcome.kind === "failed") {
        print([outcome.detail]);
        process.exitCode = 1;
      } else if (outcome.kind === "hidden") {
        print(["Tailscale no longer serves the hub."]);
      } else {
        print([
          `Public URL: ${outcome.publicUrl}`,
          `Connector URL: ${outcome.publicUrl}/mcp`,
          tailnetOnly
            ? "Only machines on your tailnet reach this URL. Run shadowclone hub pair --node to add one."
            : "Run shadowclone hub pair, then add the connector URL in Claude.",
        ]);
      }
    }),
  pair: (arguments_) =>
    withStore((store) => print(pairLines({ store, node: arguments_.includes("--node") }))),
  clients: (arguments_) =>
    withStore((store) => {
      const [operation, id] = arguments_;

      print(
        operation === "revoke" && id !== undefined
          ? [revokeLine({ store, id })]
          : clientLines(store),
      );
    }),
  nodes: (arguments_) =>
    withStore((store) => {
      const [operation, name] = arguments_;

      print(
        operation === "remove" && name !== undefined
          ? [removeNodeLine({ store, name })]
          : nodeLines(store),
      );
    }),
  notify: (arguments_) =>
    withStore(async (store) => {
      if (arguments_[0] === "test") {
        const url = store.settings().notifyUrl;

        if (url === null) {
          throw new Error("Pushes are off. Run shadowclone hub notify first.");
        }

        await sendNtfy({
          url,
          push: { title: "shadowclone hub", body: "Pushes from your hub work.", urgent: false },
        });
        print(["Sent a test push."]);

        return;
      }

      const url = flagValue({ arguments: arguments_, flag: "--url" });
      const text = arguments_.includes("--text")
        ? { text: true }
        : arguments_.includes("--no-text")
          ? { text: false }
          : {};

      print(
        notifyLines({
          store,
          ...(url === null ? {} : { url }),
          ...text,
          off: arguments_.includes("--off"),
        }),
      );
    }),
  lock: () => withStore((store) => print([lockLine({ store, locked: true })])),
  unlock: () => withStore((store) => print([lockLine({ store, locked: false })])),
  allow: (arguments_) =>
    withStore((store) =>
      print([allowLine({ store, entries: arguments_.includes("--any") ? [] : arguments_ })]),
    ),
  status: () => withStore(async (store) => print(await statusLines({ store, paths: hubPaths() }))),
  ...nodeOperations,
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
