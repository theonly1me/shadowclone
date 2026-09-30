import { expect, test } from "bun:test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { startTask, taskStatus, verifyTask } from "./index";
import {
  taskFixture,
  taskInput,
  readyTask,
  acknowledge,
  fixtureWorktree,
  fixtureHarness,
} from "./testFixture";

test("new nested repository instructions require a refreshed guidance snapshot", async () => {
  const context = await taskFixture();
  const task = await readyTask(context);
  await mkdir(path.join(context.cwd, "nested"));
  await Bun.write(
    path.join(context.cwd, "nested/AGENTS.md"),
    "Verify the nested command independently.\n",
  );
  const status = await taskStatus({ ...context, id: task.id });
  expect(status.reasons).toContain(
    "Guidance changed; review it and resume the task",
  );
  await expect(verifyTask({ ...context, id: task.id })).rejects.toThrow(
    "Guidance changed",
  );
}, 15_000);

test("workers cannot adopt a different harness while inheriting coordinator recipes", async () => {
  const context = await taskFixture();
  const parent = await startTask({ ...context, input: taskInput() });
  await acknowledge({ ...context, task: parent });
  const worker = await fixtureWorktree({
    ...context,
    name: "different-harness",
  });
  await fixtureHarness(worker);
  await expect(
    startTask({
      ...worker,
      input: taskInput({
        parentId: parent.id,
        sessionId: "worker",
        scopes: ["result.txt"],
      }),
    }),
  ).rejects.toThrow("Repository verification requirements differ");
}, 15_000);

test("workers cannot verify against repository instructions from a different checkout", async () => {
  const context = await taskFixture();
  const parent = await startTask({ ...context, input: taskInput() });
  await acknowledge({ ...context, task: parent });
  const worker = await fixtureWorktree({
    ...context,
    name: "different-instructions",
  });
  const task = await startTask({
    ...worker,
    input: taskInput({
      parentId: parent.id,
      sessionId: "worker",
      scopes: ["result.txt"],
    }),
  });
  await Bun.write(
    path.join(worker.cwd, "AGENTS.md"),
    "The worker checkout has another requirement.\n",
  );
  await expect(verifyTask({ ...worker, id: task.id })).rejects.toThrow(
    "Guidance changed",
  );
}, 15_000);
