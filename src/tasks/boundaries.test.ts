import { expect, test } from "bun:test";
import path from "node:path";
import { mkdir, symlink } from "node:fs/promises";
import { startTask, taskStatus, pauseTask } from "./index";
import { taskFixture, taskInput, readyTask, fixtureGit } from "./testFixture";
import { forgetAll } from "../cli/forget";
import { snapshotWorkspace } from "./snapshot";
import { runTaskTool } from "../mcp/tasks";

test("repository identity changes block access to old task records", async () => {
  const context = await taskFixture();
  const task = await startTask({ ...context, input: taskInput() });
  await fixtureGit({
    cwd: context.cwd,
    arguments: [
      "remote",
      "set-url",
      "origin",
      "https://github.com/another-fixture/another-repository.git",
    ],
  });
  await expect(taskStatus({ ...context, id: task.id })).rejects.toThrow(
    "another repository",
  );
}, 15_000);

test("guidance changes invalidate a previously reviewed receipt", async () => {
  const context = await taskFixture();
  const task = await readyTask(context);
  await Bun.write(
    path.join(context.cwd, "AGENTS.md"),
    "A new repository requirement.\n",
  );
  const status = await taskStatus({ ...context, id: task.id });
  expect(status.ready).toBeFalse();
  expect(status.reasons).toContain(
    "Guidance changed; review it and resume the task",
  );
}, 15_000);

test("forget refuses unfinished tasks and preserves managed worktrees", async () => {
  const context = await taskFixture();
  const task = await startTask({ ...context, input: taskInput() });
  await expect(forgetAll({ paths: context.paths })).rejects.toThrow(
    "Unfinished tasks",
  );
  expect(
    await Bun.file(
      path.join(context.paths.runDirectory(task.id), "task.json"),
    ).exists(),
  ).toBeTrue();
  await pauseTask({
    ...context,
    id: task.id,
    cancel: true,
    sessionsStopped: true,
  });
  await mkdir(context.paths.worktreesDirectory, { recursive: true });
  await Bun.write(
    path.join(context.paths.worktreesDirectory, "unfinished.txt"),
    "work\n",
  );
  await expect(forgetAll({ paths: context.paths })).rejects.toThrow(
    "Managed worktrees remain",
  );
  expect(await Bun.file(context.paths.configFile).exists()).toBeTrue();
}, 15_000);

test("MCP refuses grants and traversal while sharing the task service", async () => {
  const context = await taskFixture();
  const started = await runTaskTool({
    ...context,
    params: {
      name: "shadowclone_task",
      arguments: { operation: "start", input: taskInput() },
    },
  });
  expect(started?.isError).toBeFalse();
  expect(
    (
      await runTaskTool({
        ...context,
        params: {
          name: "shadowclone_task",
          arguments: { operation: "grant", actions: ["merge"] },
        },
      })
    )?.isError,
  ).toBeTrue();
  expect(
    (
      await runTaskTool({
        ...context,
        params: {
          name: "shadowclone_task",
          arguments: { operation: "status", id: "../../another-file" },
        },
      })
    )?.isError,
  ).toBeTrue();
}, 15_000);

test("snapshots do not follow a tracked directory replaced by an external symlink", async () => {
  const context = await taskFixture();
  const external = path.join(path.dirname(context.cwd), "external");
  await mkdir(external);
  await Bun.write(path.join(external, "value.txt"), "private\n");
  await symlink(external, path.join(context.cwd, "linked"));
  const runner = async (options: {
    readonly command: readonly string[];
    readonly cwd: string;
  }) => {
    if (options.command.includes("--cached"))
      return { exitCode: 0, stdout: "linked/value.txt\0" };
    const { runCommand } = await import("../dispatch/command");
    return runCommand(options);
  };
  await expect(snapshotWorkspace({ ...context, runner })).rejects.toThrow(
    "outside the worktree",
  );
}, 15_000);
