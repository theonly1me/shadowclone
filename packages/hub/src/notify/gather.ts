import { z } from "zod";
import type { CloneNode } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";
import type { NodeLinks } from "../fleet/links";
import type { HubStore } from "../store";
import { nodeStates, sessionStateSchema, type NodeStates } from "./states";

const statesSchema = z.array(sessionStateSchema);

export async function gatherStates(options: {
  readonly hostName: string;
  readonly node: CloneNode;
  readonly live?: LiveSessions | undefined;
  readonly links: NodeLinks;
  readonly store: HubStore;
}): Promise<readonly NodeStates[]> {
  const remote = await Promise.all(
    options.store
      .listNodes()
      .filter((node) => options.links.connected(node.name))
      .map(async (node) => {
        const states = statesSchema.safeParse(
          await options.links
            .request({ name: node.name, message: { type: "states" } })
            .catch(() => null),
        );

        return states.success ? [{ node: node.name, states: states.data }] : [];
      }),
  );

  return [
    {
      node: options.hostName,
      states: await nodeStates({ node: options.node, live: options.live }),
    },
    ...remote.flat(),
  ];
}
