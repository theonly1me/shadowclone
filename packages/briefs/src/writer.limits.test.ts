import { describe, expect, test } from "bun:test";
import { acquireLocalLock } from "@shadowclone/core";
import { briefLockFile } from "@shadowclone/live";
import { fakeSession } from "./fixtures";

const start = new Date("2026-11-10T12:00:00Z").getTime();

describe("the limits of the brief writer", () => {
  test("makes no call after 12 calls in one hour, and calls again after the hour", async () => {
    const session = await fakeSession();

    try {
      for (let callIndex = 0; callIndex < 12; callIndex += 1) {
        await session.hook("Stop", { last_assistant_message: `Message ${callIndex}.` });

        expect(await session.brief({ now: new Date(start + callIndex * 60_000) })).toMatchObject({
          kind: "written",
        });
      }

      await session.hook("Stop", { last_assistant_message: "Message 12." });

      expect(await session.brief({ now: new Date(start + 30 * 60_000) })).toEqual({
        kind: "skipped",
        reason: "limited",
      });
      expect(session.requests).toHaveLength(12);
      expect(await session.brief({ now: new Date(start + 61 * 60_000) })).toMatchObject({ kind: "written" });
      expect(session.requests).toHaveLength(13);
    } finally {
      await session.remove();
    }
  });

  test("a second writer for the same session makes no call while the first holds the lock", async () => {
    const session = await fakeSession();

    try {
      await session.hook("Stop", { last_assistant_message: "Done." });

      const lock = await acquireLocalLock(briefLockFile({ paths: session.paths, id: session.id }));

      expect(await session.brief()).toEqual({ kind: "skipped", reason: "busy" });
      expect(session.requests).toHaveLength(0);

      lock?.release();

      expect(await session.brief()).toMatchObject({ kind: "written" });
    } finally {
      await session.remove();
    }
  });

  test("makes no call for an engine that the managed policy does not allow, or for a session with no message", async () => {
    const session = await fakeSession();

    try {
      expect(await session.brief()).toEqual({ kind: "skipped", reason: "no-message" });

      await session.hook("Stop", { last_assistant_message: "Done." });

      expect(await session.brief({ allowedEngines: ["codex"] })).toEqual({
        kind: "skipped",
        reason: "engine-not-allowed",
      });
      expect(session.requests).toHaveLength(0);
    } finally {
      await session.remove();
    }
  });

  test("writes the brief again when the last message changed during the call", async () => {
    const session = await fakeSession();
    let calls = 0;

    try {
      await session.hook("Stop", { last_assistant_message: "First." });

      const outcome = await session.brief({
        model: async () => {
          calls += 1;

          if (calls === 1) {
            await session.hook("Stop", { last_assistant_message: "Second." });
          }

          return { name: `Brief ${calls}`, goal: "", done: "", kind: "finished", question: null, options: [] };
        },
      });

      expect(calls).toBe(2);
      expect(outcome).toMatchObject({ kind: "written", brief: { name: "Brief 2" } });
    } finally {
      await session.remove();
    }
  });
});
