import { describe, expect, test } from "bun:test";
import { testHub } from "./fixtures";
import { attachNode, sampleView } from "./fleetFixtures";
import { connect, rpc } from "./oauthSteps";

async function callTool(options: {
  readonly hub: Awaited<ReturnType<typeof testHub>>;
  readonly token: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}): Promise<{ readonly text: string; readonly isError: boolean }> {
  const response = await options.hub.call(
    rpc({
      token: options.token,
      method: "tools/call",
      params: { name: options.name, arguments: options.arguments },
    }),
  );
  const body = await response.json();

  return { text: body.result.content[0].text, isError: body.result.isError };
}

describe("the hub routes clone tools across nodes", () => {
  test("list shows the hub machine and each joined node, and an offline node shows when it was last seen", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);

      attachNode({
        hub,
        name: "work",
        clones: [sampleView({ id: "work0001", repository: "you/api" })],
      });
      hub.store.joinNode("laptop");

      const listed = await callTool({
        hub,
        token: accessToken,
        name: "shadowclone_sessions",
        arguments: { operation: "list" },
      });

      expect(listed.text).toContain("Node studio:\nNo clones on this machine.");
      expect(listed.text).toContain("Node work:\nwork0001 working you/api shadowclone/work0001");
      expect(listed.text).toContain("Node laptop: offline, last seen never.");
    } finally {
      await hub.remove();
    }
  });

  test("start goes to the node that the caller names, and to the hub machine without a name", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);
      const work = attachNode({ hub, name: "work", clones: [] });
      const start = (node?: string) =>
        callTool({
          hub,
          token: accessToken,
          name: "shadowclone_clone",
          arguments: {
            operation: "start",
            repository: "you/api",
            task: "fix the parser",
            ...(node === undefined ? {} : { node }),
          },
        });

      await start("work");

      expect(work.started).toEqual([
        { repository: "you/api", task: "fix the parser", review: false },
      ]);
      expect(hub.started).toEqual([]);

      await start();

      expect(hub.started).toHaveLength(1);
      expect(work.started).toHaveLength(1);
    } finally {
      await hub.remove();
    }
  });

  test("a clone id without a node goes to the node that has the clone", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);

      attachNode({
        hub,
        name: "work",
        clones: [sampleView({ id: "work0001", repository: "you/api" })],
      });

      const stopped = await callTool({
        hub,
        token: accessToken,
        name: "shadowclone_clone",
        arguments: { operation: "stop", id: "work0001" },
      });
      const missing = await callTool({
        hub,
        token: accessToken,
        name: "shadowclone_sessions",
        arguments: { operation: "get", id: "none0001" },
      });

      expect(stopped.text).toContain("work0001");
      expect(stopped.isError).toBe(false);
      expect(missing).toEqual({
        text: "No clone none0001 exists on a connected node.",
        isError: true,
      });
    } finally {
      await hub.remove();
    }
  });

  test("an unknown node name fails and names the known nodes", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);

      attachNode({ hub, name: "work", clones: [] });

      const refused = await callTool({
        hub,
        token: accessToken,
        name: "shadowclone_sessions",
        arguments: { operation: "list", node: "garage" },
      });

      expect(refused).toEqual({
        text: "No node garage joined this hub. Known nodes: studio, work.",
        isError: true,
      });
    } finally {
      await hub.remove();
    }
  });
});
