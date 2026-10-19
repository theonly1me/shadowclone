import { z } from "zod";

export const toNodeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tool"), id: z.string(), params: z.unknown() }),
  z.object({ type: z.literal("has"), id: z.string(), clone: z.string() }),
]);

export type ToNode = z.infer<typeof toNodeSchema>;

export type NodeRequest =
  | { readonly type: "tool"; readonly params: unknown }
  | { readonly type: "has"; readonly clone: string };

export const fromNodeSchema = z.object({
  type: z.literal("result"),
  id: z.string(),
  result: z.unknown(),
});

export const toolResultSchema = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1),
  isError: z.boolean(),
});

export type ToolResult = z.infer<typeof toolResultSchema>;

export function textResult(options: {
  readonly value: string;
  readonly isError?: boolean;
}): ToolResult {
  return { content: [{ type: "text", text: options.value }], isError: options.isError ?? false };
}

export function parseMessage(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const nodeProtocol = "shadowclone-node";

const tokenProtocolPrefix = "shadowclone-token.";

export function nodeProtocols(token: string): readonly string[] {
  return [nodeProtocol, `${tokenProtocolPrefix}${token}`];
}

export function tokenFromProtocols(header: string | null): string | null {
  const entry = (header ?? "")
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith(tokenProtocolPrefix));

  return entry === undefined ? null : entry.slice(tokenProtocolPrefix.length);
}

export type FetchCall = (url: string, init: RequestInit) => Promise<Response>;
