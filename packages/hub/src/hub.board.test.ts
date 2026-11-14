import { describe, expect, test } from "bun:test";
import { handleMcpRequest } from "@shadowclone/mcp";
import { boardHtml } from "./board/html";
import { fakeNode, testHub } from "./fixtures";
import { forwardedSessionTools } from "./fleet/remote";
import { attachTextNode } from "./fleetFixtures";
import { connect, rpc } from "./oauthSteps";

const boardUri = "ui://shadowclone/board.html";

async function ask(options: {
  readonly hub: Awaited<ReturnType<typeof testHub>>;
  readonly method: string;
  readonly params?: unknown;
}) {
  const { accessToken } = await connect(options.hub);
  const response = await options.hub.call(
    rpc({ token: accessToken, method: options.method, params: options.params ?? {} }),
  );

  return response.json();
}

describe("the hub serves the session board as an MCP Apps view", () => {
  test("initialize declares resources, and resources/read returns one HTML document of the MCP Apps type", async () => {
    const hub = await testHub();

    try {
      const initialized = await ask({ hub, method: "initialize" });
      const listed = await ask({ hub, method: "resources/list" });
      const read = await ask({ hub, method: "resources/read", params: { uri: boardUri } });
      const missing = await ask({ hub, method: "resources/read", params: { uri: "ui://other" } });

      expect(initialized.result.capabilities).toEqual({ tools: {}, resources: {} });
      expect(listed.result.resources.map((entry: { uri: string }) => entry.uri)).toEqual([
        boardUri,
      ]);
      expect(read.result.contents).toEqual([
        { uri: boardUri, mimeType: "text/html;profile=mcp-app", text: boardHtml },
      ]);
      expect(missing.error.code).toBe(-32002);
    } finally {
      await hub.remove();
    }
  });

  test("only the hub copy of shadowclone_sessions links to the view", async () => {
    const hub = await testHub();

    try {
      const listed = await ask({ hub, method: "tools/list" });
      const local = handleMcpRequest({
        request: { id: 1, method: "tools/list", params: {} },
        context: "",
      });
      const forwarded = forwardedSessionTools({
        link: { hubUrl: "https://hub.example.ts.net", name: "work", token: "synthetic" },
        local: fakeNode([]),
      });

      expect(
        listed.result.tools.map((tool: { name: string; _meta?: unknown }) => [
          tool.name,
          tool._meta,
        ]),
      ).toEqual([
        ["shadowclone_sessions", { ui: { resourceUri: boardUri } }],
        ["shadowclone_clone", undefined],
        ["shadowclone_pair", undefined],
      ]);
      expect(JSON.stringify(local)).not.toContain("_meta");
      expect(JSON.stringify(forwarded.list)).not.toContain("_meta");
    } finally {
      await hub.remove();
    }
  });

  test("the hub passes a known session detail from a node, and drops structured content that it does not know", async () => {
    const detail = {
      kind: "session",
      session: {
        id: "live-0000000a",
        engine: "codex",
        state: "idle",
        repository: "you/app",
        branch: null,
        folder: "app",
        startedAt: "2026-10-18T11:00:00Z",
        updatedAt: "2026-10-18T11:30:00Z",
        terminal: null,
        attention: null,
        summary: "Done.",
      },
    };
    const answer = (structuredContent: unknown) => ({
      content: [{ type: "text", text: "Live codex session live-0000000a in you/app: idle" }],
      isError: false,
      structuredContent,
    });
    const getOn = (node: string) => ({
      name: "shadowclone_sessions",
      arguments: { operation: "get", id: "live-0000000a", node },
    });
    const hub = await testHub();

    try {
      attachTextNode({ hub, name: "known", result: answer(detail) });
      attachTextNode({
        hub,
        name: "unknown",
        result: answer({ ...detail, session: { ...detail.session, prompt: "a secret" } }),
      });

      const known = await ask({ hub, method: "tools/call", params: getOn("known") });
      const unknown = await ask({ hub, method: "tools/call", params: getOn("unknown") });

      expect(known.result.structuredContent).toEqual(detail);
      expect(unknown.result.structuredContent).toBeUndefined();
      expect(unknown.result.content[0].text).toBe(
        "Live codex session live-0000000a in you/app: idle",
      );
    } finally {
      await hub.remove();
    }
  });
});
