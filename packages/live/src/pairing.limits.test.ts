import { describe, expect, test } from "bun:test";
import { peerKeyIn, sessionHandle, temporaryHome } from "./fixtures";
import { localLive } from "./sessions";

async function workingSessions(enabled = true) {
  const home = await temporaryHome();
  const sessions = ["first", "second", "third"].map((name, index) =>
    sessionHandle({
      paths: home.paths,
      engine: index === 1 ? "codex" : "claude",
      sessionId: `${name}-session`,
    }),
  );

  for (const session of sessions) {
    await session.hook("SessionStart");
    await session.hook("UserPromptSubmit");
  }

  const [first, second, third] = sessions;

  if (first === undefined || second === undefined || third === undefined) {
    throw new Error("Three sessions are needed.");
  }

  const live = localLive({
    paths: home.paths,
    enabled: async () => enabled,
    typeText: async () => false,
    now: () => new Date("2026-10-18T12:00:00Z"),
  });

  return { ...home, first, second, third, live };
}

describe("the limits of a pair", () => {
  test("a wrong key is refused, and the pair refuses a note after its 20", async () => {
    const { first, second, live, remove } = await workingSessions();

    try {
      await live.pair({ first: first.id, second: second.id });

      const key = peerKeyIn(await first.hook("PostToolUse"));
      const wrong = await live.peerSend({ key: "0".repeat(32), text: "hello" });
      const outcomes = [];

      for (let note = 1; note <= 21; note += 1) {
        outcomes.push(await live.peerSend({ key, text: `note ${note}` }));
      }

      expect(wrong).toMatchObject({ kind: "refused" });
      expect(outcomes.filter((outcome) => outcome.kind === "sent")).toHaveLength(20);
      expect(outcomes.at(-1)).toMatchObject({
        kind: "refused",
        reason: expect.stringContaining("already sent its 20 notes"),
      });
    } finally {
      await remove();
    }
  });

  test("a pair ends when either session ends, and a resumed session stays unpaired", async () => {
    const { first, second, live, remove } = await workingSessions();

    try {
      await live.pair({ first: first.id, second: second.id });

      const key = peerKeyIn(await first.hook("PostToolUse"));

      await second.hook("SessionEnd");
      await second.hook("SessionStart");

      expect(await live.pairs()).toEqual([]);
      expect(await live.peerSend({ key, text: "still there?" })).toMatchObject({
        kind: "refused",
        reason: expect.stringContaining("belongs to no open pair"),
      });
    } finally {
      await remove();
    }
  });

  test("a session joins one pair at a time, and unpair frees it", async () => {
    const { first, second, third, live, remove } = await workingSessions();

    try {
      const paired = await live.pair({ first: first.id, second: second.id });
      const pair = paired.kind === "paired" ? paired.pair : "";

      expect(await live.pair({ first: third.id, second: first.id })).toEqual({
        kind: "refused",
        reason: `${first.id} is already in ${pair}. End that pair with shadowclone live unpair ${pair} first.`,
      });
      expect(await live.unpair(pair)).toEqual({ kind: "unpaired", pair });
      expect((await live.pair({ first: third.id, second: first.id })).kind).toBe("paired");
      expect(await live.pairs()).toHaveLength(1);
    } finally {
      await remove();
    }
  });

  test("with consent off, pairing is refused and no pair exists", async () => {
    const { first, second, live, remove } = await workingSessions(false);

    try {
      expect(await live.pair({ first: first.id, second: second.id })).toMatchObject({
        kind: "refused",
        reason: expect.stringContaining("Live sessions are off"),
      });
      expect(await live.pairs()).toEqual([]);
    } finally {
      await remove();
    }
  });
});
