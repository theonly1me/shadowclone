import { describe, expect, test } from "bun:test";
import { hookContext, hookInput, temporaryHome, type TypedText } from "./fixtures";
import { handleLiveHook } from "./hook";
import { liveId } from "./record";
import { appendInbox, readRecord, takeInbox } from "./store";

const id = liveId({ engine: "claude", sessionId: "11111111-2222-3333-4444-555555555555" });

const message = "try again with the smaller model";

async function workingSessionWithMessage(typed?: TypedText[]) {
  const home = await temporaryHome();
  const context = hookContext({
    paths: home.paths,
    environment: { TMUX_PANE: "%3", TMUX: "/tmp/tmux-1/default,123,0" },
    ...(typed === undefined ? {} : { typed }),
  });

  await handleLiveHook({ context, input: hookInput("SessionStart") });
  await handleLiveHook({ context, input: hookInput("UserPromptSubmit") });
  await appendInbox({
    paths: home.paths,
    id,
    message: { kind: "owner", text: message },
    now: new Date(),
  });

  return { ...home, context };
}

describe("a live session that goes idle", () => {
  test("a Claude turn that an API error ends marks the session idle and types the waiting message", async () => {
    const typed: TypedText[] = [];
    const { paths, context, remove } = await workingSessionWithMessage(typed);

    try {
      const output = await handleLiveHook({
        context,
        input: hookInput("StopFailure", { error: "rate_limit" }),
      });

      expect(output).toBeNull();
      expect((await readRecord({ paths, id }))?.state).toBe("idle");
      expect(typed.map((entry) => entry.surface)).toEqual([
        { kind: "tmux", pane: "%3", socket: "/tmp/tmux-1/default" },
      ]);
      expect(typed[0]?.text).toContain(message);
      expect(await takeInbox({ paths, id })).toEqual([]);
    } finally {
      await remove();
    }
  });

  test("an idle notification types a message that still waits", async () => {
    const typed: TypedText[] = [];
    const { paths, context, remove } = await workingSessionWithMessage(typed);

    try {
      await handleLiveHook({
        context,
        input: hookInput("Notification", { notification_type: "idle_prompt", message: "idle" }),
      });

      expect((await readRecord({ paths, id }))?.state).toBe("idle");
      expect(typed[0]?.text).toContain(message);
    } finally {
      await remove();
    }
  });

  test("a terminal that refuses the input keeps the message for the next turn", async () => {
    const { paths, context, remove } = await workingSessionWithMessage();

    try {
      await handleLiveHook({ context, input: hookInput("StopFailure", { error: "overloaded" }) });

      expect(await takeInbox({ paths, id })).toEqual([{ kind: "owner", text: message }]);
    } finally {
      await remove();
    }
  });
});
