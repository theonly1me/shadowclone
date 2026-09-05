import { expect, test } from "bun:test";
import { handleMcpRequest } from "./server";

test("advertises one profile recall tool", () => {
  const response = handleMcpRequest({
    request: { id: 1, method: "tools/list", params: {} },
    profile: "",
  });

  expect(response).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {
      tools: [
        {
          name: "shadowclone_profile",
          description:
            "Load the active user's engineering profile for this repository",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    },
  });
});

test("returns the scoped profile through the recall tool", () => {
  const response = handleMcpRequest({
    request: {
      id: "call-1",
      method: "tools/call",
      params: { name: "shadowclone_profile", arguments: {} },
    },
    profile: "# Shadowclone profile\n\nUse Bun.",
  });

  expect(response).toEqual({
    jsonrpc: "2.0",
    id: "call-1",
    result: {
      content: [
        { type: "text", text: "# Shadowclone profile\n\nUse Bun." },
      ],
      isError: false,
    },
  });
});
