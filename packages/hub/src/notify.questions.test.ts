import { describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleLiveHook, liveId, livePaths, localLive } from "@shadowclone/live";
import { fakeNode } from "./fixtures";
import { pushFor } from "./notify/push";
import { nodeStates } from "./notify/states";

const sessionId = "cccccccc-dddd-eeee-ffff-000000000000";

describe("a push for a live session with an open question", () => {
  test("with text on, the push body holds the question text", async () => {
    const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-push-")));
    const paths = livePaths(home);
    const live = localLive({
      paths,
      enabled: async () => true,
      taskBriefs: async () => true,
      typeText: async () => false,
      questionTiming: { waitMilliseconds: 20, pollMilliseconds: 5, handoffMilliseconds: 50 },
    });

    try {
      await handleLiveHook({
        context: {
          paths,
          engine: "claude",
          now: new Date(),
          environment: {},
          gitFacts: async () => ({ repository: "you/app", branch: "feat/flags" }),
          typeText: async () => false,
        },
        input: JSON.stringify({ session_id: sessionId, hook_event_name: "SessionStart" }),
      });

      const id = liveId({ engine: "claude", sessionId });
      const asked = await live.ask({
        id,
        environment: {},
        input: {
          text: "Keep the old flag name for one release?",
          options: ["Keep it", "Remove it now"],
          recommended: "Keep it",
        },
      });
      const [state] = await nodeStates({ node: fakeNode([]), live });

      expect(asked.kind).toBe("expired");
      expect(state).toMatchObject({ id, needsYou: true });
      expect(state === undefined ? null : pushFor({ node: "work", state, withText: true })).toEqual(
        {
          title: `Live session ${id} needs you`,
          body: "you/app on work: Question: Keep the old flag name for one release?",
          urgent: true,
        },
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
