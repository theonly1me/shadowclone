import { expect, test } from "bun:test";
import { startTask, pauseTask, resumeTask, verifyTask } from "./index";
import {
  taskFixture,
  taskInput,
  acknowledge,
  fixtureWorktree,
} from "./testFixture";

test("one worktree has one durable writer and resumption requires a stopped prior session", async () => {
  const context = await taskFixture();
  const task = await startTask({ ...context, input: taskInput() });
  await expect(startTask({ ...context, input: taskInput() })).rejects.toThrow(
    "unfinished task",
  );
  await pauseTask({ ...context, id: task.id });
  await expect(startTask({ ...context, input: taskInput() })).rejects.toThrow(
    "unfinished task",
  );
  await expect(
    resumeTask({ ...context, id: task.id, input: { sessionId: "next" } }),
  ).rejects.toThrow();
  const resumed = await resumeTask({
    ...context,
    id: task.id,
    input: { sessionId: "next", previousSessionStopped: true },
  });
  expect(resumed.input.sessionId).toBe("next");
  expect(resumed.deliveries).toEqual([]);
  expect(resumed.verification).toBeNull();
}, 15_000);

test("workers inherit guidance, require disjoint scopes, and stop at two simultaneous workers", async () => {
  const context = await taskFixture();
  const parent = await startTask({ ...context, input: taskInput() });
  await acknowledge({ ...context, task: parent });
  const firstContext = await fixtureWorktree({
    ...context,
    name: "worker-first",
  });
  const secondContext = await fixtureWorktree({
    ...context,
    name: "worker-second",
  });
  const thirdContext = await fixtureWorktree({
    ...context,
    name: "worker-third",
  });
  const workerInput = taskInput({
    parentId: parent.id,
    sessionId: "first",
    scopes: ["first.txt"],
  });
  const first = await startTask({ ...firstContext, input: workerInput });
  expect(first.guidance).toEqual(parent.guidance);
  await expect(
    startTask({
      ...secondContext,
      input: taskInput({
        parentId: parent.id,
        sessionId: "second",
        scopes: ["second.txt"],
      }),
    }),
  ).rejects.toThrow("Confirm the existing worker");
  await acknowledge({ ...firstContext, task: first });
  await expect(
    startTask({ ...secondContext, input: workerInput }),
  ).rejects.toThrow("overlap");
  const second = await startTask({
    ...secondContext,
    input: taskInput({
      parentId: parent.id,
      sessionId: "second",
      scopes: ["second.txt"],
    }),
  });
  await acknowledge({ ...secondContext, task: second });
  await expect(
    startTask({
      ...thirdContext,
      input: taskInput({
        parentId: parent.id,
        sessionId: "third",
        scopes: ["third.txt"],
      }),
    }),
  ).rejects.toThrow("At most two");
  await pauseTask({ ...context, id: parent.id });
  await expect(verifyTask({ ...firstContext, id: first.id })).rejects.toThrow(
    "active tasks",
  );
}, 15_000);

test("concurrent task starts do not both acquire the same worktree", async () => {
  const context = await taskFixture();
  const results = await Promise.allSettled([
    startTask({ ...context, input: taskInput() }),
    startTask({ ...context, input: taskInput() }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
}, 15_000);

test("cancellation requires native sessions to stop before releasing ownership", async () => {
  const context = await taskFixture();
  const task = await startTask({ ...context, input: taskInput() });
  await expect(
    pauseTask({ ...context, id: task.id, cancel: true }),
  ).rejects.toThrow("Stop all native");
  await pauseTask({
    ...context,
    id: task.id,
    cancel: true,
    sessionsStopped: true,
  });
  expect((await startTask({ ...context, input: taskInput() })).state).toBe(
    "running",
  );
}, 15_000);
