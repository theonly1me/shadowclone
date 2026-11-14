import { describe, expect, test } from "bun:test";
import { askedSession, askHome, flagQuestion, type AskHome } from "./fixtures";

async function openQuestionId(home: AskHome): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const listed = await home.tool({
      name: "shadowclone_sessions",
      arguments: { operation: "list" },
    });
    const [, id] = /Open question (q[a-z0-9]{6})/.exec(listed) ?? [];

    if (id !== undefined) {
      return id;
    }

    await Bun.sleep(10);
  }

  throw new Error("No open question appeared.");
}

describe("shadowclone_ask in a live session", () => {
  test("the session shows needs-you with the options, and answer returns the text to the waiting call", async () => {
    const home = await askHome();

    try {
      const waiting = home.ask(flagQuestion);
      const question = await openQuestionId(home);
      const listed = await home.tool({
        name: "shadowclone_sessions",
        arguments: { operation: "list" },
      });
      const answered = await home.tool({
        name: "shadowclone_clone",
        arguments: { operation: "answer", id: askedSession, question, text: "Remove it now" },
      });

      expect(listed).toContain(`${askedSession} needs-you claude you/app feat/flags`);
      expect(JSON.parse(listed).structuredContent.sessions).toEqual([
        expect.objectContaining({
          id: askedSession,
          state: "needs-you",
          message: "Question: Keep the old flag name for one release?",
          question: {
            id: question,
            text: "Keep the old flag name for one release?",
            options: ["Keep it", "Remove it now"],
            recommended: "Keep it",
          },
        }),
      ]);
      expect(answered).toContain(`Live session ${askedSession} got your answer, and continues.`);
      expect(await waiting).toContain("<owner-message>\\nRemove it now\\n</owner-message>");
      expect(
        await home.tool({ name: "shadowclone_sessions", arguments: { operation: "list" } }),
      ).toContain(`${askedSession} working claude`);
    } finally {
      await home.remove();
    }
  });

  test("a second open question for the same session is refused", async () => {
    const home = await askHome({ waitMilliseconds: 300 });

    try {
      const waiting = home.ask(flagQuestion);
      const first = await openQuestionId(home);
      const second = await home.ask({ ...flagQuestion, question: "Rename the module too?" });

      expect(second).toContain(`already has an open question (${first})`);
      expect(second).toContain('"isError":true');
      await waiting;
    } finally {
      await home.remove();
    }
  });

  test("at the deadline the call tells the agent to end its turn, and the question stays open", async () => {
    const home = await askHome({ waitMilliseconds: 100 });

    try {
      const expired = await home.ask(flagQuestion);
      await home.hook("Stop");
      const listed = await home.tool({
        name: "shadowclone_sessions",
        arguments: { operation: "list" },
      });

      expect(expired).toContain("End your turn now.");
      expect(expired).toContain("do not take an option");
      expect(expired).not.toContain("Keep it");
      expect(listed).toContain(`${askedSession} needs-you claude`);
      expect(listed).toContain("Recommended: Keep it");
    } finally {
      await home.remove();
    }
  });

  test("an answer after the deadline reaches the session as an owner message", async () => {
    const home = await askHome({ waitMilliseconds: 50 });

    try {
      await home.ask(flagQuestion);
      await home.hook("Stop");
      const question = await openQuestionId(home);
      const answered = await home.tool({
        name: "shadowclone_clone",
        arguments: { operation: "answer", id: askedSession, question, text: "Keep it" },
      });

      expect(answered).toContain(`Sent your answer for live session ${askedSession}`);
      expect(home.typed.join("\n")).toContain(
        'Answer to your question "Keep the old flag name for one release?": Keep it',
      );
      expect(
        await home.tool({ name: "shadowclone_sessions", arguments: { operation: "list" } }),
      ).not.toContain("Open question");
    } finally {
      await home.remove();
    }
  });

  test("with task briefs off, or a recommended option outside the options, nothing is asked", async () => {
    const off = await askHome({ taskBriefs: false });

    try {
      expect(await off.ask(flagQuestion)).toContain("shadowclone_ask needs task briefs.");
      expect(await off.ask({ ...flagQuestion, recommended: "Skip it" })).toContain(
        "recommended, which must be one of the options",
      );
      expect(
        await off.tool({ name: "shadowclone_sessions", arguments: { operation: "list" } }),
      ).toContain(`${askedSession} idle claude`);
    } finally {
      await off.remove();
    }
  });
});
