import { expect, test } from "bun:test";
import path from "node:path";
import { startTask, checkpointTask, verifyTask, taskStatus } from "./index";
import {
  taskFixture,
  taskInput,
  acknowledge,
  readyTask,
  fixtureHarness,
  reviewTask,
} from "./testFixture";

test("an acknowledged and reviewed task is ready only for its exact tracked and untracked workspace", async () => {
  const context = await taskFixture();
  const task = await readyTask(context);
  expect((await taskStatus({ ...context, id: task.id })).ready).toBeTrue();
  await Bun.write(path.join(context.cwd, "new-file.txt"), "changed\n");
  const changed = await taskStatus({ ...context, id: task.id });
  expect(changed.ready).toBeFalse();
  expect(changed.reasons).toContain("Verification is stale");
  expect(changed.reasons).toContain("Review is stale");
}, 15_000);

test("a task with no checks cannot manufacture a passing receipt", async () => {
  const context = await taskFixture();
  const task = await startTask({
    ...context,
    input: taskInput({ verification: [] }),
  });
  await acknowledge({ ...context, task });
  const verified = await verifyTask({ ...context, id: task.id });
  expect(verified.verification?.status).toBe("incomplete");
  expect((await taskStatus({ ...context, id: task.id })).ready).toBeFalse();
}, 15_000);

test("substantive work requires a separate reviewer and every acceptance criterion", async () => {
  const context = await taskFixture();
  const task = await startTask({ ...context, input: taskInput() });
  await acknowledge({ ...context, task });
  const verified = await verifyTask({ ...context, id: task.id });
  await expect(
    reviewTask({ ...context, task: verified, sessionId: task.input.sessionId }),
  ).rejects.toThrow("different reviewer");
  expect((await taskStatus({ ...context, id: task.id })).ready).toBeFalse();
  expect((await reviewTask({ ...context, task: verified })).state).toBe(
    "review-ready",
  );
}, 15_000);

test("failed verification allows one recorded repair and then blocks further automatic attempts", async () => {
  const context = await taskFixture();
  const failing = {
    ...context,
    execute: async () => ({ exitCode: 1, output: "expected value missing" }),
  };
  const task = await startTask({ ...failing, input: taskInput() });
  await acknowledge({ ...failing, task });
  expect(
    (await verifyTask({ ...failing, id: task.id })).verification?.status,
  ).toBe("failed");
  await expect(verifyTask({ ...failing, id: task.id })).rejects.toThrow(
    "repair checkpoint",
  );
  await checkpointTask({ ...failing, id: task.id, input: { kind: "repair" } });
  expect(
    (await verifyTask({ ...failing, id: task.id })).verification?.attempts,
  ).toBe(2);
  await expect(verifyTask({ ...failing, id: task.id })).rejects.toThrow(
    "exhausted",
  );
  await expect(
    checkpointTask({ ...failing, id: task.id, input: { kind: "repair" } }),
  ).rejects.toThrow("One repair");
}, 15_000);

test("recipes clean up after failed setup and unavailable prerequisites stay incomplete", async () => {
  const context = await taskFixture();
  const commands: string[] = [];
  const execute = async (options: { readonly command: string }) => {
    commands.push(options.command);
    return {
      exitCode: options.command === "setup" ? 1 : 0,
      output: "synthetic",
    };
  };
  const task = await startTask({
    ...context,
    input: taskInput({
      verification: [
        {
          name: "runtime",
          kind: "ui",
          prerequisites: ["doctor"],
          setup: ["setup"],
          run: ["drive"],
          evidence: [],
          cleanup: ["cleanup"],
        },
      ],
    }),
  });
  const result = await verifyTask({ ...context, execute, id: task.id });
  expect(commands).toEqual(["doctor", "setup", "cleanup"]);
  expect(result.verification?.status).toBe("failed");
}, 15_000);

test("frozen repository gates cannot be removed after task start", async () => {
  const context = await taskFixture();
  await fixtureHarness(context);
  const task = await startTask({ ...context, input: taskInput() });
  const filePath = path.join(context.cwd, ".shadowclone/harness.json");
  const manifest = JSON.parse(await Bun.file(filePath).text());
  await Bun.write(filePath, JSON.stringify({ ...manifest, gate: null }));
  await expect(verifyTask({ ...context, id: task.id })).rejects.toThrow(
    "requirements changed",
  );
}, 15_000);

test("scope escapes and commands that edit source cannot pass verification", async () => {
  const context = await taskFixture();
  const task = await startTask({
    ...context,
    input: taskInput({ scopes: ["result.txt"] }),
  });
  await Bun.write(path.join(context.cwd, "outside.txt"), "unexpected\n");
  const verified = await verifyTask({ ...context, id: task.id });
  expect(
    verified.verification?.checks.some(
      (check) => check.name === "scope" && check.status === "failed",
    ),
  ).toBeTrue();
  await checkpointTask({ ...context, id: task.id, input: { kind: "repair" } });
  const execute = async () => {
    await Bun.write(
      path.join(context.cwd, "result.txt"),
      "rewritten by check\n",
    );
    return { exitCode: 0, output: "passed" };
  };
  const retried = await verifyTask({ ...context, execute, id: task.id });
  expect(
    retried.verification?.checks.some(
      (check) =>
        check.name === "workspace stability" && check.status === "incomplete",
    ),
  ).toBeTrue();
}, 15_000);
