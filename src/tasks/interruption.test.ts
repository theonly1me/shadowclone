import { expect, test } from "bun:test";
import {
  startTask,
  verifyTask,
  pauseTask,
  resumeTask,
  checkpointTask,
} from "./index";
import { taskFixture, taskInput } from "./testFixture";
import { readTask } from "./store";

test("running verification can be checkpointed and paused without holding the shared task lock", async () => {
  const context = await taskFixture();
  const task = await startTask({ ...context, input: taskInput() });
  const started = Promise.withResolvers<void>();
  const execute = async (options: { readonly signal?: AbortSignal }) => {
    started.resolve();
    const stopped = Promise.withResolvers<void>();
    if (options.signal?.aborted) stopped.resolve();
    else
      options.signal?.addEventListener("abort", () => stopped.resolve(), {
        once: true,
      });
    await stopped.promise;
    return { exitCode: 1, output: "verification was cancelled" };
  };
  const pending = verifyTask({ ...context, execute, id: task.id });
  await started.promise;
  await expect(
    pauseTask({ ...context, id: task.id, cancel: true, sessionsStopped: true }),
  ).rejects.toThrow("verification");
  expect((await readTask({ paths: context.paths, id: task.id })).state).toBe(
    "verifying",
  );
  await checkpointTask({
    ...context,
    id: task.id,
    input: { kind: "note", text: "The current session requested a pause" },
  });
  await expect(
    resumeTask({
      ...context,
      id: task.id,
      input: { sessionId: "replacement", previousSessionStopped: true },
    }),
  ).rejects.toThrow("still running");
  await pauseTask({ ...context, id: task.id });
  const result = await pending;
  expect(result.state).toBe("paused");
  expect(result.verificationOperation).toBeNull();
  expect(result.verification?.status).not.toBe("passed");
  expect(result.notes).toContain("The current session requested a pause");
  expect(
    (
      await resumeTask({
        ...context,
        id: task.id,
        input: { sessionId: "replacement", previousSessionStopped: true },
      })
    ).state,
  ).toBe("running");
}, 15_000);
