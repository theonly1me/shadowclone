import { describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleMcpRequest } from "./protocol";
import { createSessionsTools } from "./sessions";
import { fakeClones, fakeLive, idleRecord, sampleClone, waitingRecord } from "./sessionsFixtures";

const tools = createSessionsTools({
  node: fakeClones([sampleClone]),
  live: fakeLive([idleRecord, waitingRecord]),
});

async function answerOf(argumentsValue: Readonly<Record<string, unknown>>) {
  const params = { name: "shadowclone_sessions", arguments: argumentsValue };
  const shared = await tools.run(params);
  const response = handleMcpRequest({
    request: { id: 1, method: "tools/call", params },
    context: "",
    toolResult: shared,
  });

  return { shared, result: response?.result };
}

describe("the stdio server answers text clients with text only", () => {
  test("list and get keep the text of the shared tools and carry no structuredContent", async () => {
    for (const argumentsValue of [
      { operation: "list" },
      { operation: "get", id: "live-4e5f6a7b" },
    ]) {
      const { shared, result } = await answerOf(argumentsValue);

      expect(shared).toHaveProperty("structuredContent");
      expect(result).toEqual({ content: shared?.content, isError: false });
      expect(Object.keys(result ?? {})).not.toContain("structuredContent");
    }
  });

  test("a real shadowclone mcp process returns a list with no structuredContent key", async () => {
    const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-stdio-")));

    try {
      const server = Bun.spawn(["bun", path.join(import.meta.dir, "server.ts")], {
        env: { ...process.env, HOME: home },
        stdin: "pipe",
        stdout: "pipe",
      });
      const call = { name: "shadowclone_sessions", arguments: { operation: "list" } };

      server.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: call })}\n`,
      );
      server.stdin.end();

      const [line] = (await new Response(server.stdout).text()).trim().split("\n");
      const response = JSON.parse(line ?? "{}");

      await server.exited;
      expect(response.result).toEqual({
        content: [{ type: "text", text: "No clones on this machine." }],
        isError: false,
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
