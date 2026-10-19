import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { hookContext, hookInput, temporaryHome } from "./fixtures";
import { handleLiveHook, runLiveHook } from "./hook";
import { liveId } from "./record";
import { appendInbox, readRecord } from "./store";

const id = liveId({ engine: "claude", sessionId: "11111111-2222-3333-4444-555555555555" });

describe("the live session hooks", () => {
  test("with consent off, a hook writes nothing and answers nothing", async () => {
    const { paths, remove } = await temporaryHome();

    try {
      const output = await runLiveHook({
        enabled: async () => false,
        context: hookContext({ paths }),
        input: hookInput("SessionStart"),
      });

      expect(output).toBeNull();
      expect(await readdir(paths.directory).catch(() => [])).toEqual([]);
    } finally {
      await remove();
    }
  });

  test("a session records its repository and terminal, and a stop keeps a redacted summary but no tool output", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths, environment: { CMUX_SURFACE_ID: "SURFACE-1" } });

    try {
      await handleLiveHook({ context, input: hookInput("SessionStart") });
      await handleLiveHook({
        context,
        input: hookInput("UserPromptSubmit", { prompt: "fix the parser" }),
      });
      await handleLiveHook({
        context,
        input: hookInput("PostToolUse", { tool_response: { stdout: "TOOL-OUTPUT-TEXT" } }),
      });
      await handleLiveHook({
        context,
        input: hookInput("Stop", {
          last_assistant_message: `Fixed it. The token was ghp_${"a".repeat(36)}.\n${"x".repeat(5000)}`,
        }),
      });

      const record = await readRecord({ paths, id });
      const stored = await readFile(path.join(paths.directory, `${id}.json`), "utf8");

      expect(record).toMatchObject({
        repository: "you/app",
        branch: "fix/parser",
        folder: "app",
        state: "idle",
        surface: { kind: "cmux", surface: "SURFACE-1", socket: null },
      });
      expect(record?.summary.startsWith("Fixed it.")).toBe(true);
      expect(record?.summary.length).toBeLessThanOrEqual(2048);
      expect(stored).not.toContain("a".repeat(36));
      expect(stored).toContain("[redacted:github-token]");
      expect(stored).not.toContain("TOOL-OUTPUT-TEXT");
      expect(stored).not.toContain("fix the parser");
    } finally {
      await remove();
    }
  });

  test("the Stop hook delivers a queued message once", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths });

    try {
      await handleLiveHook({ context, input: hookInput("UserPromptSubmit") });
      await appendInbox({ paths, id, text: "Use the v2 endpoint.", now: new Date() });

      const first = await handleLiveHook({
        context,
        input: hookInput("Stop", { last_assistant_message: "Done." }),
      });
      const second = await handleLiveHook({
        context,
        input: hookInput("Stop", { last_assistant_message: "Done again." }),
      });

      expect(first).toEqual({
        decision: "block",
        reason:
          "A message from the owner arrived through shadowclone. Follow it, then continue.\n<owner-message>\nUse the v2 endpoint.\n</owner-message>",
      });
      expect(second).toBeNull();
      expect((await readRecord({ paths, id }))?.state).toBe("idle");
    } finally {
      await remove();
    }
  });

  test("PostToolUse adds a queued message as context during a turn, and only while one waits", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths, engine: "codex" });
    const codexId = liveId({ engine: "codex", sessionId: "11111111-2222-3333-4444-555555555555" });

    try {
      expect(await handleLiveHook({ context, input: hookInput("PostToolUse") })).toBeNull();

      await appendInbox({
        paths,
        id: codexId,
        text: "Stop after the first test.",
        now: new Date(),
      });

      const output = await handleLiveHook({ context, input: hookInput("PostToolUse") });

      expect(output).toMatchObject({ hookSpecificOutput: { hookEventName: "PostToolUse" } });
      expect(JSON.stringify(output)).toContain("Stop after the first test.");
      expect(await readdir(paths.directory)).not.toContain("pending");
    } finally {
      await remove();
    }
  });

  test("a permission prompt marks the session as needing the owner", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths });

    try {
      await handleLiveHook({
        context,
        input: hookInput("Notification", {
          notification_type: "permission_prompt",
          message: "Claude needs your permission to use Bash",
        }),
      });

      expect(await readRecord({ paths, id })).toMatchObject({
        state: "needs-you",
        attention: "Claude needs your permission to use Bash",
      });
    } finally {
      await remove();
    }
  });
});
