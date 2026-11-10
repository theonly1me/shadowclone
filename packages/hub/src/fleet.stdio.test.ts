import { describe, expect, test } from "bun:test";
import { handleMcpRequest } from "@shadowclone/mcp";
import { fakeNode } from "./fixtures";
import { forwardedSessionTools } from "./fleet/remote";

const hubAnswer = {
  content: [{ type: "text", text: "Node studio:\nNo clones on this machine." }],
  isError: false,
  structuredContent: { kind: "fleet", hub: "studio", nodes: [], sessions: [], pairs: [] },
};

describe("a joined machine answers its own sessions with text only", () => {
  test("the forwarding tools keep the hub rows, and the stdio answer drops them", async () => {
    const tools = forwardedSessionTools({
      link: { hubUrl: "https://hub.example.ts.net", name: "work", token: "synthetic" },
      local: fakeNode([]),
      fetch: async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: hubAnswer })),
    });
    const params = { name: "shadowclone_sessions", arguments: { operation: "list" } };
    const forwarded = await tools.run(params);
    const response = handleMcpRequest({
      request: { id: 1, method: "tools/call", params },
      context: "",
      toolResult: forwarded,
    });

    expect(forwarded?.structuredContent).toEqual(hubAnswer.structuredContent);
    expect(response?.result).toEqual({ content: hubAnswer.content, isError: false });
  });
});
