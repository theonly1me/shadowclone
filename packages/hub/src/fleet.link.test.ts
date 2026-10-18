import { describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runNodeLink } from "./fleet/client";
import { forwardedSessionTools } from "./fleet/remote";
import { fakeNode } from "./fixtures";
import { sampleView } from "./fleetFixtures";
import { startHubServer } from "./serve";
import { hubStore } from "./store";
import { openHubDatabase } from "./store/database";

const listCall = { name: "shadowclone_sessions", arguments: { operation: "list" } };

async function listText(tools: ReturnType<typeof forwardedSessionTools>): Promise<string> {
  const result = await tools.run(listCall);

  return result?.content.map((part) => part.text).join("\n") ?? "";
}

async function eventually(options: {
  readonly read: () => Promise<string>;
  readonly expected: string;
}): Promise<string> {
  let text = "";

  for (let attempt = 0; attempt < 200 && !text.includes(options.expected); attempt++) {
    text = await options.read();

    if (!text.includes(options.expected)) {
      await Bun.sleep(10);
    }
  }

  return text;
}

describe("a node links to the hub over a WebSocket", () => {
  test("its clones show in the list from another machine, and it shows offline after it stops", async () => {
    const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-link-")));
    const store = hubStore({
      database: openHubDatabase(path.join(directory, "hub.db")),
      now: () => new Date(),
    });
    const server = startHubServer({
      store,
      node: fakeNode([]),
      port: 0,
      hostName: "studio",
      log: () => undefined,
    });
    const controller = new AbortController();

    try {
      const link = {
        hubUrl: `http://127.0.0.1:${server.port}`,
        name: "work",
        token: store.joinNode("work"),
      };
      const running = runNodeLink({
        link,
        node: fakeNode([], [sampleView({ id: "work0001", repository: "you/api" })]),
        signal: controller.signal,
        log: () => undefined,
        wait: () => Bun.sleep(10),
      });
      const tools = forwardedSessionTools({ link, local: fakeNode([]) });
      const online = await eventually({ read: () => listText(tools), expected: "work0001" });

      expect(online).toContain("Node work:\nwork0001 working you/api");

      controller.abort();
      await running;

      const offline = await eventually({
        read: () => listText(tools),
        expected: "Node work: offline",
      });

      expect(offline).toContain("Node work: offline, last seen 2");
    } finally {
      controller.abort();
      await server.stop(true);
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("the local MCP server answers from this machine when the hub is unreachable", async () => {
    const tools = forwardedSessionTools({
      link: { hubUrl: "https://hub.example.ts.net", name: "work", token: "t".repeat(43) },
      local: fakeNode([], [sampleView({ id: "work0001", repository: "you/api" })]),
      fetch: async () => {
        throw new Error("connection refused");
      },
    });
    const result = await tools.run({ ...listCall, arguments: { operation: "list", node: "work" } });
    const text = result?.content.map((part) => part.text).join("\n") ?? "";

    expect(text).toContain(
      "The hub at https://hub.example.ts.net is unreachable (connection refused), so this answer covers only this machine.",
    );
    expect(text).toContain("work0001 working you/api");
  });
});
