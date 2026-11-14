import { describe, expect, test } from "bun:test";
import { testHub } from "./fixtures";
import { attachNode, attachTextNode, fakeLive, sampleRecord } from "./fleetFixtures";
import { connect, rpc } from "./oauthSteps";

async function listSessions(options: {
  readonly hub: Awaited<ReturnType<typeof testHub>>;
  readonly arguments?: Readonly<Record<string, unknown>>;
}) {
  const { accessToken } = await connect(options.hub);
  const response = await options.hub.call(
    rpc({
      token: accessToken,
      method: "tools/call",
      params: {
        name: "shadowclone_sessions",
        arguments: { operation: "list", ...options.arguments },
      },
    }),
  );
  const body = await response.json();

  return {
    text: String(body.result.content[0].text),
    board: body.result.structuredContent,
    size: JSON.stringify(body).length,
  };
}

const row = (options: { readonly id: string; readonly state: string; readonly node: string }) => ({
  id: options.id,
  engine: "claude",
  state: options.state,
  repository: "you/app",
  branch: "main",
  updatedAt: "2026-10-18T11:30:00Z",
  message: `Session ${options.id} finished a step.`,
  node: options.node,
});

describe("the hub merges the board rows of every node", () => {
  test("rows from each node reach the client, and a text-only node and an offline node get their own entries", async () => {
    const hub = await testHub({
      live: fakeLive([sampleRecord({ id: "live-00000001", state: "idle" })]),
    });

    try {
      attachNode({
        hub,
        name: "work",
        clones: [],
        live: fakeLive([sampleRecord({ id: "live-00000002", state: "working" })]),
      });
      attachTextNode({ hub, name: "old" });
      hub.store.joinNode("laptop");

      const listed = await listSessions({ hub });

      expect(listed.board).toEqual({
        kind: "fleet",
        hub: "studio",
        nodes: [
          { name: "studio", status: "online", live: "on", ended: 0, clones: 0 },
          { name: "laptop", status: "offline", lastSeenAt: null },
          { name: "old", status: "text", text: "No clones on this machine." },
          { name: "work", status: "online", live: "on", ended: 0, clones: 0 },
        ],
        sessions: [
          row({ id: "live-00000001", state: "idle", node: "studio" }),
          row({ id: "live-00000002", state: "working", node: "work" }),
        ],
        pairs: [],
      });
      expect(listed.text).toContain("Node old:\nNo clones on this machine.");
      expect(listed.text).toContain("Node laptop: offline, last seen never.");
    } finally {
      await hub.remove();
    }
  });

  test("a list for one named node keeps its text and tags its rows with that node", async () => {
    const hub = await testHub();

    try {
      attachNode({
        hub,
        name: "work",
        clones: [],
        live: fakeLive([sampleRecord({ id: "live-00000002", state: "needs-you" })]),
      });

      const listed = await listSessions({ hub, arguments: { node: "work" } });

      expect(listed.text.split("\n")).toEqual([
        "No clones on this machine.",
        "Live sessions:",
        "live-00000002 needs-you claude you/app main 2026-10-18T11:30:00Z Session live-00000002 finished a step.",
      ]);
      expect(listed.board.nodes).toEqual([
        { name: "work", status: "online", live: "on", ended: 0, clones: 0 },
      ]);
      expect(listed.board.sessions).toEqual([
        row({ id: "live-00000002", state: "needs-you", node: "work" }),
      ]);
    } finally {
      await hub.remove();
    }
  });

  test("a list of 300 sessions with the longest messages stays under 150,000 characters, because ended rows become a count", async () => {
    const records = Array.from({ length: 300 }, (_, index) => ({
      ...sampleRecord({
        id: `live-${index.toString(16).padStart(8, "0")}`,
        state: index < 290 ? "ended" : "idle",
      }),
      repository: "someone/a-repository-with-a-long-name",
      branch: "feature/a-branch-name-that-is-long-enough",
      summary: "m".repeat(400),
    }));
    const hub = await testHub({ live: fakeLive(records) });

    try {
      const listed = await listSessions({ hub });

      expect(listed.board.sessions).toHaveLength(10);
      expect(listed.board.nodes[0].ended).toBe(290);
      expect(listed.size).toBeLessThan(150_000);
    } finally {
      await hub.remove();
    }
  });
});
