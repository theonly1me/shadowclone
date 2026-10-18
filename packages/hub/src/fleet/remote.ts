import { z } from "zod";
import type { CloneNode } from "@shadowclone/clones";
import { createSessionsTools } from "@shadowclone/mcp";
import type { NodeLink } from "./client";
import {
  parseMessage,
  textResult,
  toolResultSchema,
  type FetchCall,
  type ToolResult,
} from "./protocol";
import { fleetToolList } from "./tools";

const callSchema = z.object({
  name: z.enum(["shadowclone_sessions", "shadowclone_clone"]),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

const responseSchema = z.object({ result: toolResultSchema });

async function askHub(options: {
  readonly link: NodeLink;
  readonly params: unknown;
  readonly fetch: FetchCall;
}): Promise<ToolResult> {
  const response = await options.fetch(`${options.link.hubUrl}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.link.token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: options.params }),
    signal: AbortSignal.timeout(20_000),
  });
  const parsed = responseSchema.safeParse(parseMessage(await response.text()));

  if (!response.ok || !parsed.success) {
    throw new Error(`the hub answered ${response.status}`);
  }

  return parsed.data.result;
}

export function forwardedSessionTools(options: {
  readonly link: NodeLink;
  readonly local: CloneNode;
  readonly fetch?: FetchCall;
}) {
  const local = createSessionsTools({ node: options.local });

  return {
    list: fleetToolList,
    run: async (params: unknown): Promise<ToolResult | null> => {
      const call = callSchema.safeParse(params);

      if (!call.success) {
        return null;
      }

      try {
        return await askHub({
          link: options.link,
          params: call.data,
          fetch: options.fetch ?? fetch,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const fallback = toolResultSchema.safeParse(
          await local.run({
            name: call.data.name,
            arguments: Object.fromEntries(
              Object.entries(call.data.arguments).filter(([key]) => key !== "node"),
            ),
          }),
        );
        const text = fallback.success
          ? fallback.data.content.map((part) => part.text).join("\n")
          : "";

        return textResult({
          value: `The hub at ${options.link.hubUrl} is unreachable (${reason}), so this answer covers only this machine.\n${text}`,
          isError: !fallback.success || fallback.data.isError,
        });
      }
    },
  };
}
