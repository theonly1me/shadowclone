import { describe, expect, test } from "bun:test";
import { temporaryClones } from "../fixtures";
import { localNode } from "../node";
import { progressedRecord, startedRecord } from "../node/transitions";
import { writeRecord } from "../node/store";
import { fakeLaunch, serveContext, settle, startedClone, until } from "./fakeLaunch";
import { scanRuns, serveClones } from "./server";

describe("serve stops clones and recovers", () => {
  test("a stop marker stops a working clone, and a queued clone with a marker never starts", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      let next = 0;
      const node = localNode({ paths, newId: () => `clone00${next++}` });
      const { launch, started } = fakeLaunch();
      const context = serveContext({ paths, launch });

      for (const task of ["first", "second", "third"]) {
        await node.start({ repository: "sample/project", task });
      }

      await scanRuns({ context, running: context.running });
      await until(() => started.length === 2);
      await node.stop("clone000");
      await node.stop("clone002");
      await scanRuns({ context, running: context.running });

      const first = startedClone({ started, id: "clone000" });
      const second = startedClone({ started, id: "clone001" });

      expect(first.signal.aborted).toBe(true);
      expect(second.signal.aborted).toBe(false);

      first.finish(143);
      second.finish(1);
      await settle(context.running);
      await scanRuns({ context, running: context.running });

      expect(started).toHaveLength(2);
      expect((await node.get("clone000"))?.state).toBe("stopped");
      expect(await node.get("clone002")).toMatchObject({
        state: "stopped",
        detail: "You stopped the clone before it started.",
      });
    } finally {
      await remove();
    }
  });

  test("a second serve on the same machine stops at the lock", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const { launch } = fakeLaunch();
      const first = serveContext({ paths, launch });
      const controller = new AbortController();
      const running = serveClones({ ...first, signal: controller.signal, scanEvery: 5 });

      await until(() => first.lines.length > 0);

      expect(
        await serveClones({ ...serveContext({ paths, launch }), signal: controller.signal }),
      ).toBe("already-running");

      controller.abort();

      expect(await running).toBe("stopped");
    } finally {
      await remove();
    }
  });

  test("a clone that was working when the node stopped is marked stopped at the next start", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const node = localNode({ paths, newId: () => "clone000" });

      await node.start({ repository: "sample/project", task: "fix the parser" });
      await writeRecord({ paths, id: "clone000", record: startedRecord(new Date()) });

      const { launch, started } = fakeLaunch();

      expect(
        await serveClones({ ...serveContext({ paths, launch }), signal: AbortSignal.abort() }),
      ).toBe("stopped");
      expect(started).toHaveLength(0);
      expect(await node.get("clone000")).toMatchObject({
        state: "stopped",
        detail:
          "The node stopped while the clone ran. Its work is on the branch if the save finished.",
      });
    } finally {
      await remove();
    }
  });
  test("a clone that waited for an answer when the node stopped is marked stopped, so its issue is free again", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      let next = 0;
      const node = localNode({ paths, newId: () => `clone00${next++}` });

      await node.start({ repository: "sample/project", task: "", issue: 12 });
      await writeRecord({
        paths,
        id: "clone000",
        record: progressedRecord({
          record: startedRecord(new Date()),
          progress: {
            state: "waiting",
            detail: "The clone asks a question.",
            question: { id: "qabc123", text: "Keep the old API?", options: [], recommended: "yes" },
          },
          now: new Date(),
        }),
      });

      const { launch, started } = fakeLaunch();

      expect(
        await serveClones({ ...serveContext({ paths, launch }), signal: AbortSignal.abort() }),
      ).toBe("stopped");
      expect(started).toHaveLength(0);
      expect(await node.get("clone000")).toMatchObject({ state: "stopped", needsYou: false });
      expect((await node.start({ repository: "sample/project", task: "", issue: 12 })).kind).toBe(
        "queued",
      );
    } finally {
      await remove();
    }
  });
});
