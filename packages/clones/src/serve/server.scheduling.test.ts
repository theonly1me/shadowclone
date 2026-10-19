import { describe, expect, test } from "bun:test";
import { sampleConfig, temporaryClones } from "../fixtures";
import { localNode } from "../node";
import { fakeLaunch, serveContext, settle, startedClone, until } from "./fakeLaunch";
import { scanRuns } from "./server";

describe("serve starts queued clones", () => {
  test("a queued clone starts, and its progress lines become its state", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const node = localNode({ paths, newId: () => "clone000" });
      const { launch, started } = fakeLaunch();
      const context = serveContext({ paths, launch });

      await node.start({ repository: "sample/project", task: "fix the parser" });
      await scanRuns({ context, running: context.running });
      await until(() => started.length === 1);

      const [clone] = started;

      if (clone === undefined) {
        throw new Error("The clone did not start.");
      }

      await clone.onProgress({
        state: "working",
        branch: "shadowclone/clone000",
        engine: "claude",
        detail: "The agent is working.",
      });
      expect(await node.get("clone000")).toMatchObject({
        state: "working",
        branch: "shadowclone/clone000",
      });

      await clone.onProgress({ state: "done", pull: 40, detail: "The clone finished." });
      clone.finish(0);
      await settle(context.running);

      expect(await node.get("clone000")).toMatchObject({
        state: "done",
        pull: 40,
        detail: "The clone finished.",
      });
    } finally {
      await remove();
    }
  });

  test("a container that exits without a final progress line is failed, not done", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const node = localNode({ paths, newId: () => "clone000" });
      const { launch, started } = fakeLaunch();
      const context = serveContext({ paths, launch });

      await node.start({ repository: "sample/project", task: "fix the parser" });
      await scanRuns({ context, running: context.running });
      await until(() => started.length === 1);
      started[0]?.finish(0);
      await settle(context.running);

      expect(await node.get("clone000")).toMatchObject({
        state: "failed",
        detail: "The container exited with code 0 before it reported a result.",
      });
    } finally {
      await remove();
    }
  });

  test("a third clone waits while two run, and starts when one finishes", async () => {
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
      await scanRuns({ context, running: context.running });

      expect(started.map((clone) => clone.request.id).sort()).toEqual(["clone000", "clone001"]);
      expect((await node.get("clone002"))?.state).toBe("queued");

      const firstDone = context.running.get("clone000")?.done;

      startedClone({ started, id: "clone000" }).finish(1);
      await firstDone;
      await scanRuns({ context, running: context.running });
      await until(() => started.length === 3);

      expect(started[2]?.request.id).toBe("clone002");
    } finally {
      await remove();
    }
  });

  test("two clones on one ChatGPT plan login never run at the same time", async () => {
    const { paths, remove } = await temporaryClones([
      sampleConfig({ provider: "chatgpt-subscription" }),
    ]);

    try {
      let next = 0;
      const node = localNode({ paths, newId: () => `clone00${next++}` });
      const { launch, started } = fakeLaunch();
      const context = serveContext({ paths, launch });

      await node.start({ repository: "sample/project", task: "first" });
      await node.start({ repository: "sample/project", task: "second" });
      await scanRuns({ context, running: context.running });
      await until(() => started.length === 1);
      await scanRuns({ context, running: context.running });

      expect(started).toHaveLength(1);
      expect((await node.get("clone001"))?.state).toBe("queued");
    } finally {
      await remove();
    }
  });
});
