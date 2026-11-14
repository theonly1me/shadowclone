import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { hookContext, hookInput, temporaryHome } from "./fixtures";
import { handleLiveHook } from "./hook";
import { createQuestion, readQuestion, type LiveQuestion } from "./questionStore";
import { liveId } from "./record";
import { readRecord } from "./store";

const id = liveId({ engine: "claude", sessionId: "11111111-2222-3333-4444-555555555555" });

const question: LiveQuestion = {
  id: "qflag01",
  text: "Keep the old flag name for one release?",
  options: ["Keep it", "Remove it now"],
  recommended: "Keep it",
  askedAt: "2026-10-18T11:59:00Z",
  waitUntil: "2026-10-18T11:59:50Z",
  answer: null,
};

describe("the ask note at session start", () => {
  test("with task briefs on, SessionStart tells the agent its live id and when to call shadowclone_ask", async () => {
    const { paths, remove } = await temporaryHome();

    try {
      const output = await handleLiveHook({
        context: hookContext({ paths, startedWriters: [] }),
        input: hookInput("SessionStart"),
      });

      expect(output).toEqual({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: `This is shadowclone live session ${id}. When a decision is the owner's and the task text does not answer it, call shadowclone_ask with session ${id}, the question, 2 to 4 options, and your recommended option.`,
        },
      });
    } finally {
      await remove();
    }
  });

  test("with task briefs off, SessionStart gives no output", async () => {
    const { paths, remove } = await temporaryHome();

    try {
      expect(
        await handleLiveHook({ context: hookContext({ paths }), input: hookInput("SessionStart") }),
      ).toBeNull();
    } finally {
      await remove();
    }
  });
});

describe("an open question in the hooks", () => {
  test("a Stop keeps the session at needs-you while its question is open", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths });

    try {
      await handleLiveHook({ context, input: hookInput("SessionStart") });
      await createQuestion({ paths, id, question });
      await handleLiveHook({
        context,
        input: hookInput("Stop", { last_assistant_message: "Which name?" }),
      });

      expect(await readRecord({ paths, id })).toMatchObject({
        state: "needs-you",
        attention: "Question: Keep the old flag name for one release?",
        summary: "Which name?",
      });
    } finally {
      await remove();
    }
  });

  test("a session that ends removes its open question", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths });

    try {
      await handleLiveHook({ context, input: hookInput("SessionStart") });
      await createQuestion({ paths, id, question });
      await handleLiveHook({ context, input: hookInput("SessionEnd") });

      expect(await readQuestion({ paths, id })).toBeNull();
      expect(await readdir(paths.directory)).toEqual([`${id}.json`]);
    } finally {
      await remove();
    }
  });

  test("a prompt typed after the wait closes the question, and a second question cannot replace it", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths });

    try {
      await handleLiveHook({ context, input: hookInput("SessionStart") });
      expect(await createQuestion({ paths, id, question })).toBe(true);
      expect(await createQuestion({ paths, id, question: { ...question, id: "qflag02" } })).toBe(
        false,
      );
      expect((await readQuestion({ paths, id }))?.id).toBe("qflag01");

      await handleLiveHook({
        context,
        input: hookInput("UserPromptSubmit", { prompt: "Keep it." }),
      });

      expect(await readQuestion({ paths, id })).toBeNull();
      expect(await readRecord({ paths, id })).toMatchObject({ state: "working", attention: null });
    } finally {
      await remove();
    }
  });
});
