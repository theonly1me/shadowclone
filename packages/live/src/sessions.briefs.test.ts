import { describe, expect, test } from "bun:test";
import { briefMessageDigest, saveBrief, type LiveBrief } from "./brief";
import { temporaryHome, sessionHandle } from "./fixtures";
import type { LivePaths } from "./paths";
import { localLive } from "./sessions";

const lastMessage = "Renamed it. Keep the old name?";

function brief(messageDigest: string): LiveBrief {
  return {
    name: "Rename the parser",
    goal: "The owner wants the parser renamed.",
    done: "The agent renamed it.",
    kind: "question",
    question: "Keep the old name?",
    options: ["Keep it", "Remove it"],
    messageDigest,
    writtenAt: "2026-10-18T12:00:01.000Z",
  };
}

async function briefsOf(options: {
  readonly paths: LivePaths;
  readonly briefsEnabled: boolean;
}): Promise<ReadonlyMap<string, LiveBrief>> {
  const live = localLive({
    paths: options.paths,
    enabled: async () => true,
    briefsEnabled: async () => options.briefsEnabled,
    typeText: async () => false,
    now: () => new Date("2026-10-18T12:05:00Z"),
  });

  const records = await live.list();

  expect(records).toHaveLength(1);

  return live.currentBriefs(records);
}

async function idleSession(paths: LivePaths) {
  const session = sessionHandle({
    paths,
    engine: "claude",
    sessionId: "aaaaaaaa-0000-0000-0000-000000000001",
  });

  await session.hook("SessionStart");
  await session.hook("UserPromptSubmit");
  await session.hook("Stop", { last_assistant_message: lastMessage });

  return session;
}

describe("the current brief of each live session", () => {
  test("a brief of the last message is current while task briefs are on", async () => {
    const { paths, remove } = await temporaryHome();

    try {
      const { id } = await idleSession(paths);

      await saveBrief({ paths, id, brief: brief(briefMessageDigest(lastMessage)) });

      expect((await briefsOf({ paths, briefsEnabled: true })).get(id)?.name).toBe(
        "Rename the parser",
      );
    } finally {
      await remove();
    }
  });

  test("task briefs off give no brief, even when a current brief file exists", async () => {
    const { paths, remove } = await temporaryHome();

    try {
      const { id } = await idleSession(paths);

      await saveBrief({ paths, id, brief: brief(briefMessageDigest(lastMessage)) });

      expect((await briefsOf({ paths, briefsEnabled: false })).size).toBe(0);
    } finally {
      await remove();
    }
  });

  test("a brief of an earlier message, or of a working session, is not current", async () => {
    const { paths, remove } = await temporaryHome();

    try {
      const session = await idleSession(paths);

      await saveBrief({
        paths,
        id: session.id,
        brief: brief(briefMessageDigest("An earlier message.")),
      });
      expect((await briefsOf({ paths, briefsEnabled: true })).size).toBe(0);

      await saveBrief({ paths, id: session.id, brief: brief(briefMessageDigest(lastMessage)) });
      await session.hook("UserPromptSubmit");
      expect((await briefsOf({ paths, briefsEnabled: true })).size).toBe(0);
    } finally {
      await remove();
    }
  });
});
