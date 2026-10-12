import { expect, test } from "bun:test";
import product from "@shadowclone/core/product.json";
import { handleMcpRequest } from "./server";
import { preferenceTools } from "./preferences";
import { botTools } from "./bot";

test("responds to initialize with protocol version and serverInfo", () => {
  const response = handleMcpRequest({
    request: { id: 1, method: "initialize", params: {} },
    context: "",
  });

  expect(response).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "shadowclone", version: product.version },
    },
  });
});

test("advertises the context, preference, and bot tools without the removed profile alias", () => {
  const response = handleMcpRequest({
    request: { id: 1, method: "tools/list", params: {} },
    context: "",
  });

  expect(response).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {
      tools: [
        ...preferenceTools,
        ...botTools,
        {
          name: "shadowclone_context",
          description: "Inspect applicable learned skills and native routing for this repository",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    },
  });
});

test("returns the scoped context through the context tool", () => {
  const response = handleMcpRequest({
    request: {
      id: "call-1",
      method: "tools/call",
      params: { name: "shadowclone_context", arguments: {} },
    },
    context: "# Shadowclone guidance\n\n- Use Bun.",
  });

  expect(response).toEqual({
    jsonrpc: "2.0",
    id: "call-1",
    result: {
      content: [{ type: "text", text: "# Shadowclone guidance\n\n- Use Bun." }],
      isError: false,
    },
  });
});
