import { expect, test } from "bun:test";
import path from "node:path";
import { sandboxedGate } from "../dispatch/gate";
import { startTask, verifyTask } from "./index";
import { taskFixture, taskInput, acknowledge } from "./testFixture";

test("native task verification runs offline and cannot rewrite Git control files", async () => {
  const context = await taskFixture();
  const gitDirectory = path.join(context.cwd, ".git");
  const probe = await sandboxedGate({
    directory: context.cwd,
    command: "true",
    blockedPaths: [context.paths.shadowcloneDirectory],
    protectedPaths: [gitDirectory],
  }).catch(() => null);
  if (probe?.exitCode !== 0) {
    if (process.env.CI)
      throw new Error("The native task verification sandbox is unavailable");
    console.log(
      "Task sandbox integration requires the targeted check outside the current host sandbox.",
    );
    return;
  }
  const original = await Bun.file(path.join(gitDirectory, "HEAD")).text();
  const task = await startTask({
    ...context,
    input: taskInput({
      verification: [
        {
          name: "offline CLI",
          kind: "cli",
          prerequisites: [],
          setup: [],
          run: ["test -f result.txt", "! printf forbidden > .git/HEAD"],
          evidence: [],
          cleanup: [],
        },
      ],
    }),
  });
  await acknowledge({ ...context, task });
  const result = await verifyTask({
    ...context,
    execute: sandboxedGate,
    id: task.id,
  });
  expect(result.verification?.status).toBe("passed");
  expect(await Bun.file(path.join(gitDirectory, "HEAD")).text()).toBe(original);
}, 15_000);
