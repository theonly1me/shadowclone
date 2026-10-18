import { z } from "zod";
import type { CloneNode } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";
import { holds } from "./holds";
import { createSessionsTools, sessionsTools } from "@shadowclone/mcp";
import type { HubStore } from "../store";
import { nodeNamePattern } from "../store/nodes";
import type { NodeLinks } from "./links";
import { textResult, toolResultSchema, type ToolResult } from "./protocol";

const nodeProperty = {
  type: "string",
  description: "the node name from list. start uses the hub machine when it is empty",
};

export const fleetToolList = sessionsTools.map((tool) => ({
  ...tool,
  inputSchema: {
    ...tool.inputSchema,
    properties: { ...tool.inputSchema.properties, node: nodeProperty },
  },
}));

const callSchema = z.object({
  name: z.enum(["shadowclone_sessions", "shadowclone_clone"]),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

const routingSchema = z.object({
  node: z.string().regex(nodeNamePattern).optional(),
  operation: z.string().optional(),
  id: z.string().optional(),
});

export type Fleet = {
  readonly hostName: string;
  readonly local: CloneNode;
  readonly live?: LiveSessions;
  readonly links: NodeLinks;
  readonly store: HubStore;
};

async function runOn(options: {
  readonly fleet: Fleet;
  readonly node: string;
  readonly params: { readonly name: string; readonly arguments: Readonly<Record<string, unknown>> };
}): Promise<ToolResult> {
  const { fleet, node, params } = options;

  if (node === fleet.hostName) {
    const result = await createSessionsTools({
      node: fleet.local,
      ...(fleet.live === undefined ? {} : { live: fleet.live }),
    }).run(params);
    const parsed = toolResultSchema.safeParse(result);

    return parsed.success ? parsed.data : textResult({ value: "Unknown tool.", isError: true });
  }

  try {
    const parsed = toolResultSchema.safeParse(
      await fleet.links.request({ name: node, message: { type: "tool", params } }),
    );

    return parsed.success
      ? parsed.data
      : textResult({
          value: `Node ${node} sent an answer that the hub cannot read.`,
          isError: true,
        });
  } catch (error) {
    return textResult({
      value: error instanceof Error ? error.message : String(error),
      isError: true,
    });
  }
}

async function ownerOf(options: {
  readonly fleet: Fleet;
  readonly id: string;
}): Promise<string | null> {
  const { fleet, id } = options;

  if (await holds({ node: fleet.local, live: fleet.live, id })) {
    return fleet.hostName;
  }

  for (const node of fleet.store.listNodes()) {
    if (fleet.links.connected(node.name)) {
      const found = await fleet.links
        .request({ name: node.name, message: { type: "has", clone: id } })
        .catch(() => false);

      if (found === true) {
        return node.name;
      }
    }
  }

  return null;
}

async function listEverywhere(options: {
  readonly fleet: Fleet;
  readonly params: { readonly name: string; readonly arguments: Readonly<Record<string, unknown>> };
}): Promise<ToolResult> {
  const { fleet, params } = options;
  const nodes = fleet.store.listNodes();

  if (nodes.length === 0) {
    return runOn({ fleet, node: fleet.hostName, params });
  }

  const sections = await Promise.all(
    [fleet.hostName, ...nodes.map((node) => node.name)].map(async (name) => {
      const node = nodes.find((entry) => entry.name === name);

      if (node !== undefined && !fleet.links.connected(name)) {
        return `Node ${name}: offline, last seen ${node.lastSeenAt ?? "never"}.`;
      }

      const result = await runOn({ fleet, node: name, params });

      return `Node ${name}:\n${result.content.map((part) => part.text).join("\n")}`;
    }),
  );

  return textResult({ value: sections.join("\n\n") });
}

export function fleetTools(fleet: Fleet) {
  return {
    list: fleetToolList,
    call: async (raw: unknown): Promise<ToolResult | null> => {
      const call = callSchema.safeParse(raw);

      if (!call.success) {
        return null;
      }

      const routing = routingSchema.safeParse(call.data.arguments);

      if (!routing.success) {
        return textResult({
          value: "Name the node with lowercase letters, digits, and dashes.",
          isError: true,
        });
      }

      const params = {
        name: call.data.name,
        arguments: Object.fromEntries(
          Object.entries(call.data.arguments).filter(([key]) => key !== "node"),
        ),
      };
      const known = [fleet.hostName, ...fleet.store.listNodes().map((node) => node.name)];
      const { node, operation, id } = routing.data;

      if (node !== undefined) {
        return known.includes(node)
          ? runOn({ fleet, node, params })
          : textResult({
              value: `No node ${node} joined this hub. Known nodes: ${known.join(", ")}.`,
              isError: true,
            });
      }

      if (operation === "list") {
        return listEverywhere({ fleet, params });
      }

      if (id === undefined || operation === "start") {
        return runOn({ fleet, node: fleet.hostName, params });
      }

      const owner = await ownerOf({ fleet, id });

      return owner === null
        ? textResult({ value: `No clone ${id} exists on a connected node.`, isError: true })
        : runOn({ fleet, node: owner, params });
    },
  };
}
