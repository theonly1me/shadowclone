import { describe, expect, test } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { hookContext, hookInput, temporaryHome } from "./fixtures";
import { handleLiveHook } from "./hook";
import { liveId } from "./record";
import { readRecord } from "./store";

const id = liveId({ engine: "claude", sessionId: "11111111-2222-3333-4444-555555555555" });

describe("a task brief failure inside the hook", () => {
  test("a writer start that throws leaves the Stop hook result as with task briefs off", async () => {
    const { paths, remove } = await temporaryHome();
    const context = {
      ...hookContext({ paths }),
      taskBriefs: {
        startWriter: () => {
          throw new Error("spawn failed");
        },
      },
    };

    try {
      const output = await handleLiveHook({
        context,
        input: hookInput("Stop", { last_assistant_message: "Done." }),
      });

      expect(output).toBeNull();
      expect(await readRecord({ paths, id })).toMatchObject({ state: "idle", summary: "Done." });
    } finally {
      await remove();
    }
  });

  test("a task file that cannot be written leaves the UserPromptSubmit hook result as with task briefs off", async () => {
    const { paths, remove } = await temporaryHome();
    const context = hookContext({ paths, startedWriters: [] });

    try {
      await mkdir(path.join(paths.directory, `${id}.task.json`, "blocked"), { recursive: true });

      const output = await handleLiveHook({
        context,
        input: hookInput("UserPromptSubmit", { prompt: "Rename the parser." }),
      });

      expect(output).toBeNull();
      expect(await readRecord({ paths, id })).toMatchObject({ state: "working" });
      expect((await readdir(paths.directory)).sort()).toEqual([`${id}.json`, `${id}.task.json`]);
    } finally {
      await remove();
    }
  });
});
