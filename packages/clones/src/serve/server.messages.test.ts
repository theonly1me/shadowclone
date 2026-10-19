import { describe, expect, test } from "bun:test";
import { temporaryClones } from "../fixtures";
import { localNode } from "../node";
import { fakeLaunch, serveContext, settle, startedClone, until } from "./fakeLaunch";
import { scanRuns } from "./server";

const question = { id: "qabc123", text: "Delete the old API?", options: [], recommended: "no" };

describe("serve delivers the owner's messages", () => {
  test("a message reaches the running clone once, and an answer closes its question", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const node = localNode({ paths, newId: () => "clone000" });
      const { launch, started } = fakeLaunch();
      const context = serveContext({ paths, launch });

      await node.start({ repository: "sample/project", task: "fix the parser" });
      await scanRuns({ context, running: context.running });
      await until(() => started.length === 1);

      const clone = startedClone({ started, id: "clone000" });

      await clone.onProgress({
        state: "working",
        question,
        detail: "The clone asked: Delete the old API?",
      });

      expect((await node.get("clone000"))?.needsYou).toBe(true);
      expect((await node.send({ id: "clone000", text: "Use the v2 endpoint." })).kind).toBe("sent");
      expect(
        (await node.answer({ id: "clone000", question: "qabc123", text: "Keep it." })).kind,
      ).toBe("sent");

      await scanRuns({ context, running: context.running });
      await scanRuns({ context, running: context.running });

      expect(clone.delivered.map((line) => JSON.parse(line).kind)).toEqual(["message", "answer"]);
      expect(await node.get("clone000")).toMatchObject({
        needsYou: false,
        questions: [{ id: "qabc123", status: "answered", answer: "Keep it." }],
      });
      expect(await node.answer({ id: "clone000", question: "qabc123", text: "Again." })).toEqual({
        kind: "refused",
        reason: "Clone clone000 has no open question qabc123.",
      });

      clone.finish(0);
      await settle(context.running);

      expect(await node.send({ id: "clone000", text: "Too late." })).toEqual({
        kind: "refused",
        reason: "Clone clone000 already ended: failed.",
      });
    } finally {
      await remove();
    }
  });
});
