import { expect, test } from "bun:test";
import path from "node:path";
import { startTask, checkpointTask, verifyTask, taskStatus } from "./index";
import {
  taskFixture,
  taskInput,
  acknowledge,
  fixtureWorktree,
  reviewTask,
} from "./testFixture";

test("a completed worker cannot make its coordinator ready until the result is actually integrated", async () => {
  const context = await taskFixture();
  const parent = await startTask({ ...context, input: taskInput() });
  await acknowledge({ ...context, task: parent });
  const workerContext = await fixtureWorktree({
    ...context,
    name: "integration-worker",
  });
  const child = await startTask({
    ...workerContext,
    input: taskInput({
      parentId: parent.id,
      sessionId: "worker",
      scopes: ["result.txt"],
    }),
  });
  await acknowledge({ ...workerContext, task: child });
  await Bun.write(
    path.join(workerContext.cwd, "result.txt"),
    "completed worker result\n",
  );
  const verified = await verifyTask({ ...workerContext, id: child.id });
  await reviewTask({ ...workerContext, task: verified });
  await checkpointTask({
    ...workerContext,
    id: child.id,
    input: { kind: "complete" },
  });
  const input = {
    kind: "integration",
    childId: child.id,
    childSnapshot: verified.verification?.snapshot.fingerprint,
  };
  expect((await taskStatus({ ...context, id: parent.id })).reasons).toContain(
    "Completed worker results need an integration checkpoint",
  );
  await expect(
    checkpointTask({ ...context, id: parent.id, input }),
  ).rejects.toThrow("changed files");
  await Bun.write(
    path.join(context.cwd, "result.txt"),
    "completed worker result\n",
  );
  const integrated = await checkpointTask({ ...context, id: parent.id, input });
  expect(integrated.integrations?.[0]?.childId).toBe(child.id);
  await reviewTask({
    ...context,
    task: await verifyTask({ ...context, id: parent.id }),
  });
  expect((await taskStatus({ ...context, id: parent.id })).ready).toBeTrue();
}, 20_000);
