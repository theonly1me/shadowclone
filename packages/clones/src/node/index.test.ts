import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sampleConfig, temporaryClones } from "../fixtures";
import { localNode } from ".";

function counter(): () => string {
  let next = 0;

  return () => `clone${String(next++).padStart(3, "0")}`;
}

describe("starting clones on this machine", () => {
  test("start queues a clone that list and get report as queued", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const node = localNode({ paths, newId: counter() });
      const outcome = await node.start({ repository: "sample/project", task: "fix the parser" });

      expect(outcome).toMatchObject({
        kind: "queued",
        clone: { id: "clone000", state: "queued", summary: "fix the parser" },
        serveRunning: false,
      });
      expect((await node.list({})).clones.map((clone) => [clone.id, clone.state])).toEqual([
        ["clone000", "queued"],
      ]);
      expect((await node.get("clone000"))?.task).toBe("fix the parser");
    } finally {
      await remove();
    }
  });

  test("a repository with no setup on this machine starts nothing and names the setup command", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const node = localNode({ paths, newId: counter() });

      expect(await node.start({ repository: "other/project", task: "fix it" })).toEqual({
        kind: "refused",
        reason:
          "other/project has no clone setup on this machine. Run shadowclone clone setup --repo other/project.",
      });
      expect((await node.list({})).clones).toEqual([]);
    } finally {
      await remove();
    }
  });

  test("a setup saved by an earlier version asks for setup again", async () => {
    const { paths, remove } = await temporaryClones([]);

    try {
      await mkdir(paths.repositoriesDirectory, { recursive: true });
      await writeFile(
        path.join(paths.repositoriesDirectory, "sample__project.json"),
        JSON.stringify({ ...sampleConfig(), version: 1, host: "local" }),
      );

      expect(
        await localNode({ paths }).start({ repository: "sample/project", task: "fix it" }),
      ).toEqual({
        kind: "refused",
        reason:
          "The clone setup for sample/project is from an earlier version of shadowclone. Run shadowclone clone setup --repo sample/project again.",
      });
    } finally {
      await remove();
    }
  });

  test("the clone over the daily limit is refused, and a clone from yesterday does not count", async () => {
    const { paths, remove } = await temporaryClones([sampleConfig({ dailyClones: 2 })]);

    try {
      let now = new Date("2026-10-17T09:00:00Z");
      const node = localNode({ paths, newId: counter(), now: () => now });

      await node.start({ repository: "sample/project", task: "first" });
      now = new Date("2026-10-18T10:00:00Z");
      await node.start({ repository: "sample/project", task: "second" });

      expect((await node.start({ repository: "sample/project", task: "third" })).kind).toBe(
        "queued",
      );
      expect(await node.start({ repository: "sample/project", task: "fourth" })).toEqual({
        kind: "refused",
        reason:
          "sample/project already had 2 clones in the last 24 hours, and its limit is 2.",
      });
    } finally {
      await remove();
    }
  });

  test("a second clone for the same issue is refused until the first one stops", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const node = localNode({ paths, newId: counter() });

      await node.start({ repository: "sample/project", task: "", issue: 12 });

      expect(await node.start({ repository: "sample/project", task: "", issue: 12 })).toEqual({
        kind: "refused",
        reason:
          "Clone clone000 already works on issue #12. Stop it first, or wait until it finishes.",
      });
      expect(await node.stop("clone000")).toMatchObject({
        kind: "stopping",
        clone: { state: "stopped" },
      });
      expect(
        (await node.start({ repository: "sample/project", task: "", issue: 12 })).kind,
      ).toBe("queued");
    } finally {
      await remove();
    }
  });

  test("two callers that start a clone for one issue at the same time queue only one", async () => {
    const { paths, remove } = await temporaryClones();

    try {
      const first = localNode({ paths, newId: () => "clonea00" });
      const second = localNode({ paths, newId: () => "cloneb00" });
      const outcomes = await Promise.all(
        [first, second].map((node) =>
          node.start({ repository: "sample/project", task: "", issue: 12 }),
        ),
      );

      expect(outcomes.map((outcome) => outcome.kind).sort()).toEqual(["queued", "refused"]);
      expect((await first.list({})).clones).toHaveLength(1);
    } finally {
      await remove();
    }
  });

  test("a review needs a pull request, and a provider with no review support is refused", async () => {
    const { paths, remove } = await temporaryClones([
      sampleConfig(),
      sampleConfig({
        repository: "sample/local",
        provider: "ollama",
        baseUrl: "http://host.docker.internal:11434/v1",
        model: "gpt-oss:20b",
      }),
    ]);

    try {
      const node = localNode({ paths, newId: counter() });

      expect(await node.start({ repository: "sample/project", task: "", review: true })).toEqual({
        kind: "refused",
        reason: "A review needs a pull request number and no issue.",
      });
      expect(
        await node.start({ repository: "sample/local", task: "", review: true, pull: 4 }),
      ).toEqual({ kind: "refused", reason: "Reviews do not support the ollama provider yet." });
      expect(
        (await node.start({ repository: "sample/project", task: "", review: true, pull: 4 }))
          .kind,
      ).toBe("queued");
    } finally {
      await remove();
    }
  });
});
