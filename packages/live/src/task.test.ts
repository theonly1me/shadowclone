import { describe, expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { hookContext, hookInput, temporaryHome } from "./fixtures";
import { handleLiveHook } from "./hook";
import { liveId } from "./record";
import { appendInbox } from "./store";
import { readTask } from "./task";

const id = liveId({ engine: "claude", sessionId: "11111111-2222-3333-4444-555555555555" });

const syntheticToken = `ghp_${"b".repeat(36)}`;

describe("the task file of a live session", () => {
  test("with task briefs off, a prompt and a stop store no task file and start no writer", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths });

    try {
      await handleLiveHook({ context, input: hookInput("UserPromptSubmit", { prompt: "rename the parser" }) });
      await handleLiveHook({ context, input: hookInput("Stop", { last_assistant_message: "Done." }) });

      expect(await readdir(paths.directory)).toEqual([`${id}.json`]);
    } finally {
      await remove();
    }
  });

  test("with task briefs on, the hook keeps the redacted first and latest prompt with mode 0600", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths, startedWriters: [] });
    const taskFile = path.join(paths.directory, `${id}.task.json`);

    try {
      await handleLiveHook({
        context,
        input: hookInput("UserPromptSubmit", {
          prompt: `Rename the parser. The token is ${syntheticToken}.\n${"y".repeat(5000)}`,
        }),
      });
      await handleLiveHook({
        context,
        input: hookInput("UserPromptSubmit", { prompt: "Now add the tests." }),
      });
      await handleLiveHook({
        context,
        input: hookInput("UserPromptSubmit", { prompt: "SUBAGENT-PROMPT", agent_id: "agent-1" }),
      });

      const stored = await readFile(taskFile, "utf8");
      const task = await readTask({ paths, id });

      expect(task?.latest).toBe("Now add the tests.");
      expect(task?.first.startsWith("Rename the parser. The token is ")).toBe(true);
      expect(task?.first).toContain("[redacted:github-token]");
      expect(task?.first.length).toBe(2048);
      expect(stored).not.toContain("b".repeat(36));
      expect(stored).not.toContain("SUBAGENT-PROMPT");
      expect((await stat(taskFile)).mode & 0o777).toBe(0o600);
    } finally {
      await remove();
    }
  });

  test("a prompt field that is not text keeps the hook working and stores nothing", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths, startedWriters: [] });

    try {
      await handleLiveHook({ context, input: hookInput("UserPromptSubmit", { prompt: null }) });

      expect(await readdir(paths.directory)).toEqual([`${id}.json`]);
    } finally {
      await remove();
    }
  });

  test("a stop that leaves the session idle starts the writer, and a stop that delivers a message does not", async () => {
    const { paths, remove } = await temporaryHome();
    const startedWriters: string[] = [];
    const context = hookContext({ paths, startedWriters });

    try {
      await handleLiveHook({ context, input: hookInput("Stop", { last_assistant_message: "Done." }) });
      await appendInbox({ paths, id, message: { kind: "owner", text: "Also fix the docs." }, now: new Date() });
      await handleLiveHook({ context, input: hookInput("Stop", { last_assistant_message: "Done again." }) });

      expect(startedWriters).toEqual([id]);
    } finally {
      await remove();
    }
  });
});
