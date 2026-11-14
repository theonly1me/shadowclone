import { describe, expect, test } from "bun:test";
import { createSessionsTools } from "./sessions";
import { fakeClones, fakeLive, idleRecord, sampleClone, waitingRecord } from "./sessionsFixtures";

async function structuredOf(options: {
  readonly tools: ReturnType<typeof createSessionsTools>;
  readonly arguments: Readonly<Record<string, unknown>>;
}): Promise<unknown> {
  const result = await options.tools.run({
    name: "shadowclone_sessions",
    arguments: options.arguments,
  });

  return typeof result === "object" && result !== null && "structuredContent" in result
    ? result.structuredContent
    : undefined;
}

const endedRecord = { ...idleRecord, id: "live-99999999", state: "ended" } as const;

const tools = createSessionsTools({
  node: fakeClones([sampleClone]),
  live: fakeLive([idleRecord, waitingRecord, endedRecord]),
});

describe("the session tools give the board typed rows beside the text", () => {
  test("list gives each open live session, the pairs, the ended count, and the clone count", async () => {
    expect(await structuredOf({ tools, arguments: { operation: "list" } })).toEqual({
      kind: "list",
      live: "on",
      sessions: [
        {
          id: "live-0a1b2c3d",
          engine: "codex",
          state: "idle",
          repository: "you/app",
          branch: "fix/parser",
          updatedAt: "2026-10-18T11:30:00Z",
          message: "The parser now keeps quoted commas.",
        },
        {
          id: "live-4e5f6a7b",
          engine: "claude",
          state: "needs-you",
          repository: "you/web",
          branch: null,
          updatedAt: "2026-10-18T11:45:00Z",
          message: "Allow Bash: bun test?",
        },
      ],
      pairs: [
        {
          id: "pair-0a1b2c3d",
          sessions: ["live-0a1b2c3d", "live-4e5f6a7b"],
          sent: 4,
          limit: 20,
          createdAt: "2026-10-18T11:10:00Z",
        },
      ],
      ended: 1,
      clones: 1,
    });
  });

  test("a list row carries only the fields that the text line already sends", async () => {
    const board = await structuredOf({ tools, arguments: { operation: "list" } });
    const rows =
      typeof board === "object" &&
      board !== null &&
      "sessions" in board &&
      Array.isArray(board.sessions)
        ? board.sessions
        : [];

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => Object.keys(row).sort())).toEqual([
      ["branch", "engine", "id", "message", "repository", "state", "updatedAt"],
      ["branch", "engine", "id", "message", "repository", "state", "updatedAt"],
    ]);
  });

  test("get of a live session gives the fields of the detail text", async () => {
    expect(
      await structuredOf({ tools, arguments: { operation: "get", id: "live-0a1b2c3d" } }),
    ).toEqual({
      kind: "session",
      session: {
        id: "live-0a1b2c3d",
        engine: "codex",
        state: "idle",
        repository: "you/app",
        branch: "fix/parser",
        folder: "app",
        startedAt: "2026-10-18T11:00:00Z",
        updatedAt: "2026-10-18T11:30:00Z",
        terminal: "cmux",
        attention: null,
        summary: "\nThe parser now keeps quoted commas.\nShould I open the pull request?",
      },
    });
  });

  test("get of a clone gives text only, and a machine without live sessions says they are off", async () => {
    const offline = createSessionsTools({ node: fakeClones([]) });

    expect(
      await structuredOf({ tools, arguments: { operation: "get", id: "clone001" } }),
    ).toBeUndefined();
    expect(await structuredOf({ tools: offline, arguments: { operation: "list" } })).toEqual({
      kind: "list",
      live: "off",
      sessions: [],
      pairs: [],
      ended: 0,
      clones: 0,
    });
  });
});
