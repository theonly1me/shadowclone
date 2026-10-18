import path from "node:path";
import os from "node:os";
import { clonesPaths, localNode } from "@shadowclone/clones";
import {
  forwardedSessionTools,
  hubHostName,
  hubPaths,
  joinHub,
  readLink,
  removeLink,
  runNodeLink,
} from "@shadowclone/hub";
import { machineLive } from "@shadowclone/live";
import { serveMcp } from "@shadowclone/mcp";
import { flagValue } from "./cloneOptions";
import { print, runAsService, stopSignal, timestamped } from "./hubCommon";

const linkService = {
  label: "dev.shadowclone.node",
  unit: "shadowclone-node.service",
  description: "shadowclone node link",
  command: ["hub", "link"],
  log: path.join(hubPaths().logsDirectory, "link.log"),
};

export async function mcpCommand(): Promise<void> {
  const link = await readLink(hubPaths()).catch(() => null);

  await serveMcp(
    link === null
      ? {}
      : {
          sessionTools: forwardedSessionTools({
            link,
            local: localNode({ paths: clonesPaths() }),
            live: machineLive(),
          }),
        },
  );
}

export const nodeOperations: Readonly<
  Record<string, (arguments_: readonly string[]) => Promise<void>>
> = {
  join: async (arguments_) => {
    const [hubUrl] = arguments_;
    const code = flagValue({ arguments: arguments_, flag: "--code" });
    const name = flagValue({ arguments: arguments_, flag: "--name" }) ?? hubHostName(os.hostname());

    if (hubUrl === undefined || hubUrl.startsWith("--") || code === null || code === "") {
      throw new Error("Use shadowclone hub join <hub URL> --code <code> [--name <name>].");
    }

    const outcome = await joinHub({ paths: hubPaths(), hubUrl, code, name });

    if (outcome.kind === "refused") {
      print([outcome.reason]);
      process.exitCode = 1;

      return;
    }

    print([`This machine joined ${outcome.link.hubUrl} as ${outcome.link.name}.`]);

    if (!arguments_.includes("--no-service")) {
      await runAsService({ service: linkService, what: "node link" });
    }
  },
  link: async () => {
    const link = await readLink(hubPaths());

    if (link === null) {
      throw new Error("This machine did not join a hub. Run shadowclone hub join first.");
    }

    await runNodeLink({
      link,
      node: localNode({ paths: clonesPaths() }),
      live: machineLive(),
      signal: stopSignal(),
      log: timestamped,
    });
  },
  leave: async () => {
    print([
      (await removeLink(hubPaths()))
        ? "This machine left the hub. Stop the node link service, and run shadowclone hub nodes remove <name> on the hub."
        : "This machine did not join a hub.",
    ]);
  },
};
