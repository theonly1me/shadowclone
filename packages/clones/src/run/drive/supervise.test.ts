import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Progress } from "../../node/progress";
import { appendAskedQuestion } from "../ask/questions";
import { noAnswerText } from "./messages";
import { superviseEngine } from "./supervise";
import { turnQueue, type EngineDriver, type TurnEnd } from "./turns";

function fakeDriver() {
  const turns = turnQueue();
  const sent: string[] = [];
  let active = true;
  const driver: EngineDriver = {
    send: async (text) => {
      sent.push(text);
      active = true;
    },
    nextTurnEnd: turns.next,
    busy: () => active,
    close: async () => 0,
  };
  const endTurn = (end: TurnEnd) => {
    active = false;
    turns.push(end);
  };

  return { driver, sent, endTurn };
}

function controlledInbox() {
  const lines: string[] = [];
  let wake: (() => void) | null = null;
  const inbox: AsyncIterable<string> = {
    [Symbol.asyncIterator]: async function* () {
      while (true) {
        const [first] = lines.splice(0, 1);

        if (first !== undefined) {
          yield first;
        } else {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
      }
    },
  };

  return {
    inbox,
    push: (value: unknown) => {
      lines.push(JSON.stringify(value));
      wake?.();
    },
  };
}

async function folder(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "shadowclone-supervise-"));
}

const question = {
  id: "qabc123",
  text: "Delete the old API?",
  options: ["yes", "no"],
  recommended: "no",
};

describe("the clone supervisor", () => {
  test("a turn that ends with an open question waits, and the owner's answer continues the work", async () => {
    const root = await folder();

    try {
      const questionsFile = path.join(root, "questions.jsonl");
      const { driver, sent, endTurn } = fakeDriver();
      const { inbox, push } = controlledInbox();
      const reports: Progress[] = [];
      const supervision = superviseEngine({
        driver,
        inbox,
        questionsFile,
        report: (progress) => reports.push(progress),
        base: { engine: "claude" },
        signal: new AbortController().signal,
        pollMilliseconds: 5,
      });

      await appendAskedQuestion({ file: questionsFile, question });
      endTurn({ outcome: "completed", summary: "Waiting on the owner." });

      for (
        let attempt = 0;
        attempt < 200 && !reports.some((progress) => progress.state === "waiting");
        attempt++
      ) {
        await Bun.sleep(5);
      }

      expect(reports.find((progress) => progress.question !== undefined)?.question).toEqual(
        question,
      );
      expect(reports.at(-1)?.state).toBe("waiting");

      push({ kind: "answer", at: "2026-10-18T12:00:00Z", question: "qabc123", text: "Keep it." });

      for (let attempt = 0; attempt < 200 && sent.length === 0; attempt++) {
        await Bun.sleep(5);
      }

      expect(sent[0]).toContain("The owner answered your question: Delete the old API?");
      expect(sent[0]).toContain("Keep it.");

      endTurn({ outcome: "completed", summary: "Kept the old API." });

      expect(await supervision).toEqual({
        outcome: "completed",
        summary: "Kept the old API.",
        exitCode: 0,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("no answer before the deadline expires the question, and the clone takes its recommended option", async () => {
    const root = await folder();

    try {
      const questionsFile = path.join(root, "questions.jsonl");
      const { driver, sent, endTurn } = fakeDriver();
      const reports: Progress[] = [];
      const supervision = superviseEngine({
        driver,
        inbox: controlledInbox().inbox,
        questionsFile,
        report: (progress) => reports.push(progress),
        base: { engine: "codex" },
        signal: new AbortController().signal,
        pollMilliseconds: 5,
        waitMilliseconds: 20,
      });

      await appendAskedQuestion({ file: questionsFile, question });
      endTurn({ outcome: "completed", summary: "Waiting." });

      for (let attempt = 0; attempt < 200 && sent.length === 0; attempt++) {
        await Bun.sleep(5);
      }

      expect(sent).toEqual([noAnswerText]);
      expect(reports.find((progress) => progress.expired !== undefined)?.expired).toEqual([
        "qabc123",
      ]);

      endTurn({ outcome: "completed", summary: "Took the recommended option." });

      expect((await supervision).summary).toBe("Took the recommended option.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("an owner message reaches the engine inside owner-message markers", async () => {
    const root = await folder();

    try {
      const { driver, sent, endTurn } = fakeDriver();
      const { inbox, push } = controlledInbox();
      const supervision = superviseEngine({
        driver,
        inbox,
        questionsFile: path.join(root, "questions.jsonl"),
        report: () => undefined,
        base: {},
        signal: new AbortController().signal,
      });

      push({ kind: "message", at: "2026-10-18T12:00:00Z", text: "Use the v2 endpoint." });

      for (let attempt = 0; attempt < 200 && sent.length === 0; attempt++) {
        await Bun.sleep(5);
      }

      expect(sent[0]).toBe(
        "A message from the owner arrived while you worked. Follow it, then continue the task.\n<owner-message>\nUse the v2 endpoint.\n</owner-message>",
      );

      endTurn({ outcome: "completed", summary: "Used v2." });

      expect((await supervision).outcome).toBe("completed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
