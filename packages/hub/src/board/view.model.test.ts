import { describe, expect, test } from "bun:test";
import type { FleetBoard, FleetSession } from "./schema";
import {
  emptyText,
  endedText,
  headline,
  loudSession,
  nodeNotice,
  sessionGroups,
} from "./view/model";

function session(options: {
  readonly id: string;
  readonly state: FleetSession["state"];
  readonly updatedAt: string;
}): FleetSession {
  return {
    id: options.id,
    engine: "claude",
    state: options.state,
    repository: "you/app",
    branch: "main",
    updatedAt: options.updatedAt,
    message: `Message of ${options.id}.`,
    node: "studio",
  };
}

const sessions = [
  session({ id: "live-00000001", state: "working", updatedAt: "2026-10-18T11:50:00Z" }),
  session({ id: "live-00000002", state: "idle", updatedAt: "2026-10-18T11:10:00Z" }),
  session({ id: "live-00000003", state: "needs-you", updatedAt: "2026-10-18T11:20:00Z" }),
  session({ id: "live-00000004", state: "idle", updatedAt: "2026-10-18T11:40:00Z" }),
];

function board(options: {
  readonly sessions: readonly FleetSession[];
  readonly live?: "on" | "off";
}): FleetBoard {
  return {
    kind: "fleet",
    hub: "studio",
    nodes: [
      { name: "studio", status: "online", live: options.live ?? "on", ended: 149, clones: 0 },
    ],
    sessions: [...options.sessions],
    pairs: [],
  };
}

describe("the board model", () => {
  test("groups show needs you, then your turn, then working, each newest first", () => {
    const groups = sessionGroups(sessions);

    expect(groups.needsYou.map((entry) => entry.id)).toEqual(["live-00000003"]);
    expect(groups.yourTurn.map((entry) => entry.id)).toEqual(["live-00000004", "live-00000002"]);
    expect(groups.working.map((entry) => entry.id)).toEqual(["live-00000001"]);
  });

  test("the loud card is the newest session that waits for you, never a working one", () => {
    const working = session({
      id: "live-00000009",
      state: "working",
      updatedAt: "2026-10-18T12:00:00Z",
    });

    expect(loudSession(board({ sessions: [...sessions, working] }))?.id).toBe("live-00000004");
    expect(loudSession(board({ sessions: [working] }))).toBeNull();
  });

  test("the headline counts the sessions that wait, and ended sessions show only as a count", () => {
    expect(headline(board({ sessions }))).toEqual([
      "1 session needs you.",
      "2 wait for your reply.",
    ]);
    expect(endedText(board({ sessions }))).toBe("149 sessions ended.");
  });

  test("an empty board says how to start, or that live sessions are off", () => {
    expect(emptyText(board({ sessions: [] }))).toBe(
      "No sessions run on this machine. Start Claude Code or Codex, and it shows here.",
    );
    expect(emptyText(board({ sessions: [], live: "off" }))).toBe(
      "Live sessions are off on this machine. Run shadowclone live enable there.",
    );
    expect(emptyText(board({ sessions }))).toBeNull();
  });

  test("an older node asks for an update, and an offline node is a fault", () => {
    expect(nodeNotice({ name: "old", status: "text", text: "No clones on this machine." })).toEqual(
      {
        tone: "quiet",
        text: "Update shadowclone on old.\nNo clones on this machine.",
      },
    );
    expect(nodeNotice({ name: "laptop", status: "offline", lastSeenAt: null })).toEqual({
      tone: "fault",
      text: "laptop is offline. Last seen never.",
    });
  });
});
