import { describe, expect, test } from "bun:test";
import { hookContext, hookInput, temporaryHome, type TypedText } from "./fixtures";
import { handleLiveHook } from "./hook";
import { liveId } from "./record";
import { localLive } from "./sessions";

const id = liveId({ engine: "claude", sessionId: "11111111-2222-3333-4444-555555555555" });

async function sessionIn(options: {
  readonly state: "idle" | "working";
  readonly environment: Readonly<Record<string, string>>;
}) {
  const home = await temporaryHome();
  const context = hookContext({ paths: home.paths, environment: options.environment });

  await handleLiveHook({ context, input: hookInput("SessionStart") });

  if (options.state === "working") {
    await handleLiveHook({ context, input: hookInput("UserPromptSubmit") });
  }

  return { ...home, context };
}

describe("sending to a live session", () => {
  test("an idle session in tmux gets the message typed into its pane", async () => {
    const { paths, remove } = await sessionIn({
      state: "idle",
      environment: { TMUX_PANE: "%3", TMUX: "/tmp/tmux-1/default,123,0", CMUX_SURFACE_ID: "OUTER" },
    });
    const typed: TypedText[] = [];

    try {
      const live = localLive({
        paths,
        enabled: async () => true,
        typeText: async (entry) => {
          typed.push(entry);

          return true;
        },
      });
      const outcome = await live.send({ id, text: "Run the tests\u001b[2J again." });

      expect(outcome.kind).toBe("typed");
      expect(typed).toEqual([
        {
          surface: { kind: "tmux", pane: "%3", socket: "/tmp/tmux-1/default" },
          text: "A message from the owner arrived through shadowclone. Follow it, then continue. <owner-message> Run the tests [2J again. </owner-message>",
        },
      ]);
    } finally {
      await remove();
    }
  });

  test("a refused terminal keeps the message for the next Stop hook", async () => {
    const { paths, context, remove } = await sessionIn({
      state: "idle",
      environment: { CMUX_SURFACE_ID: "S1" },
    });

    try {
      const live = localLive({ paths, enabled: async () => true, typeText: async () => false });
      const outcome = await live.send({ id, text: "Use v2." });
      const stop = await handleLiveHook({
        context,
        input: hookInput("Stop", { last_assistant_message: "ok" }),
      });

      expect(outcome.kind).toBe("queued");
      expect(JSON.stringify(stop)).toContain("Use v2.");
    } finally {
      await remove();
    }
  });

  test("a working session queues the message and types nothing", async () => {
    const { paths, remove } = await sessionIn({
      state: "working",
      environment: { TMUX_PANE: "%3" },
    });
    const typed: TypedText[] = [];

    try {
      const live = localLive({
        paths,
        enabled: async () => true,
        typeText: async (entry) => {
          typed.push(entry);

          return true;
        },
      });

      expect(await live.send({ id, text: "Use v2." })).toEqual({
        kind: "queued",
        detail: "It reaches the session after its next tool call, or when its turn ends.",
      });
      expect(typed).toEqual([]);
    } finally {
      await remove();
    }
  });

  test("with consent off, the list is empty and a send is refused", async () => {
    const { paths, remove } = await sessionIn({ state: "idle", environment: {} });

    try {
      const live = localLive({ paths, enabled: async () => false, typeText: async () => true });

      expect(await live.list()).toEqual([]);
      expect(await live.get(id)).toBeNull();
      expect((await live.send({ id, text: "hi" })).kind).toBe("refused");
    } finally {
      await remove();
    }
  });
});
