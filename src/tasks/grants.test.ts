import { expect, test } from "bun:test";
import path from "node:path";
import {
  actOnTask,
  checkpointTask,
  setTaskGrant,
  startTask,
  taskStatus,
  verifyTask,
} from "./index";
import {
  taskFixture,
  taskInput,
  readyTask,
  acknowledge,
  reviewTask,
} from "./testFixture";
import { taskCommandLine } from "../cli/tasks";
import { readTask } from "./store";

test("a saved grant alone cannot authorize an action outside the task allowance", async () => {
  const context = await taskFixture();
  await setTaskGrant({ ...context, actions: ["commit"] });
  const task = await startTask({ ...context, input: taskInput() });
  await Bun.write(path.join(context.cwd, "result.txt"), "requested\n");
  await acknowledge({ ...context, task });
  await reviewTask({
    ...context,
    task: await verifyTask({ ...context, id: task.id }),
  });
  await expect(
    actOnTask({
      ...context,
      id: task.id,
      input: { action: "commit", subject: "fix: update result" },
    }),
  ).rejects.toThrow("matching task allowance");
  expect(
    (await readTask({ paths: context.paths, id: task.id })).actions,
  ).toEqual([]);
}, 15_000);

test("revoking repository grants invalidates readiness before any Git write", async () => {
  const context = await taskFixture();
  await setTaskGrant({ ...context, actions: ["push"] });
  const task = await readyTask({
    ...context,
    input: taskInput({ actions: ["push"] }),
  });
  expect((await taskStatus({ ...context, id: task.id })).ready).toBeTrue();
  await setTaskGrant({ ...context, actions: [] });
  expect((await taskStatus({ ...context, id: task.id })).reasons).toContain(
    "Repository grant changed; resume with the current allowance",
  );
  await expect(
    actOnTask({ ...context, id: task.id, input: { action: "push" } }),
  ).rejects.toThrow("current repository grant");
}, 15_000);

test("owner grant confirmation can be declined without creating an authorization", async () => {
  const context = await taskFixture();
  await taskCommandLine({
    context,
    arguments: ["grant", "commit,push"],
    confirm: () => false,
    writeLine: () => {},
  });
  const task = await readyTask({
    ...context,
    input: taskInput({ actions: ["commit"] }),
  });
  expect(task.grantRevision).toBeNull();
}, 15_000);

test("an authorized real local commit invalidates head-bound verification until checked again", async () => {
  const context = await taskFixture();
  await setTaskGrant({ ...context, actions: ["commit"] });
  const task = await startTask({
    ...context,
    input: taskInput({ actions: ["commit"] }),
  });
  await Bun.write(path.join(context.cwd, "result.txt"), "requested\n");
  await acknowledge({ ...context, task });
  await reviewTask({
    ...context,
    task: await verifyTask({ ...context, id: task.id }),
  });
  const committed = await actOnTask({
    ...context,
    id: task.id,
    input: { action: "commit", subject: "fix: update result" },
  });
  expect(committed.actions[0]?.state).toBe("completed");
  expect((await taskStatus({ ...context, id: task.id })).reasons).toContain(
    "Verification is stale",
  );
  await reviewTask({
    ...context,
    task: await verifyTask({ ...context, id: task.id }),
  });
  const completed = await checkpointTask({
    ...context,
    id: task.id,
    input: { kind: "complete" },
  });
  expect(completed.state).toBe("done");
}, 15_000);

test("automatic commit preserves dirty changes that predate task start", async () => {
  const context = await taskFixture();
  await setTaskGrant({ ...context, actions: ["commit"] });
  await Bun.write(path.join(context.cwd, "unrelated.txt"), "preserve me\n");
  const task = await readyTask({
    ...context,
    input: taskInput({ actions: ["commit"] }),
  });
  await expect(
    actOnTask({
      ...context,
      id: task.id,
      input: { action: "commit", subject: "fix: result" },
    }),
  ).rejects.toThrow("existing changes");
  expect(await Bun.file(path.join(context.cwd, "unrelated.txt")).text()).toBe(
    "preserve me\n",
  );
}, 15_000);
