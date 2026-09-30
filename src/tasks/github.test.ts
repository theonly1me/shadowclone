import { expect, test } from "bun:test";
import path from "node:path";
import { runCommand, type CommandRunner } from "../dispatch/command";
import { actOnTask, maintainTask, reconcileTask, setTaskGrant } from "./index";
import { writeTask, readTask } from "./store";
import { readyTask, taskFixture, taskInput } from "./testFixture";
import type { TaskRecord } from "./schema";

function githubRunner(options: {
  readonly task: TaskRecord;
  readonly queued?: boolean;
  readonly stale?: boolean;
  readonly failReply?: boolean;
  readonly noRequiredChecks?: boolean;
  readonly failedChecks?: boolean;
  readonly beforeChecks?: () => Promise<void>;
}) {
  const commands: readonly string[][] = [];
  const recorded: string[][] = [...commands];
  let merged = false;
  let replyId = "";
  const runner: CommandRunner = async (input) => {
    if (input.command[0] !== "gh") return runCommand(input);
    recorded.push([...input.command]);
    if (input.command[1] === "api")
      return { exitCode: 0, stdout: "synthetic-author\n" };
    if (input.command[2] === "checks") {
      if (options.noRequiredChecks && input.command.includes("--required"))
        return { exitCode: 1, stdout: "" };
      await options.beforeChecks?.();
      return {
        exitCode: options.failedChecks ? 1 : 0,
        stdout: JSON.stringify([
          {
            name: "ci",
            bucket: options.failedChecks ? "fail" : "pass",
            link: "https://github.com/synthetic-fixture/task-repository/actions/runs/1",
          },
        ]),
      };
    }
    if (input.command[2] === "merge") {
      merged = !options.queued;
      return { exitCode: 0, stdout: "requested" };
    }
    if (input.command[2] === "comment") {
      const index = input.command.indexOf("--body-file");
      const filePath = input.command[index + 1];
      if (!filePath) throw new Error("Missing comment fixture body");
      replyId = await Bun.file(filePath).text();
      return { exitCode: options.failReply ? 1 : 0, stdout: "" };
    }
    const head = options.stale
      ? "1".repeat(40)
      : options.task.verification?.snapshot.head;
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        number: 17,
        url: "https://github.com/synthetic-fixture/task-repository/pull/17",
        state: merged ? "MERGED" : "OPEN",
        headRefName: options.task.baseline.branch,
        headRefOid: head,
        isCrossRepository: false,
        isDraft: false,
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: "APPROVED",
        author: { login: "synthetic-author" },
        comments: replyId
          ? [
              {
                body: replyId,
                url: "https://github.com/synthetic-fixture/task-repository/pull/17#issuecomment-1",
              },
            ]
          : [],
        reviews: [
          {
            state: "APPROVED",
            body: "Reviewed synthetic change",
            commit: { oid: head },
          },
        ],
      }),
    };
  };
  return { runner, commands: recorded };
}

async function shippingFixture() {
  const context = await taskFixture();
  await setTaskGrant({ ...context, actions: ["merge", "pr-reply"] });
  const task = await readyTask({
    ...context,
    input: taskInput({ actions: ["merge", "pr-reply"], finish: "ship" }),
  });
  const stored = await writeTask({
    paths: context.paths,
    task: { ...task, pullRequest: 17 },
  });
  return { context, task: stored };
}

test("unavailable required-check metadata falls back to all checks without ignoring failures", async () => {
  const { context, task } = await shippingFixture();
  const available = githubRunner({ task, noRequiredChecks: true });
  expect(
    (await maintainTask({ ...context, runner: available.runner, id: task.id }))
      .ready,
  ).toBeTrue();
  expect(
    available.commands.filter((command) => command[2] === "checks"),
  ).toHaveLength(2);
  const failed = githubRunner({
    task,
    noRequiredChecks: true,
    failedChecks: true,
  });
  expect(
    (await maintainTask({ ...context, runner: failed.runner, id: task.id }))
      .ready,
  ).toBeFalse();
}, 15_000);

test("merge uses exact-head protection and confirms GitHub completion", async () => {
  const { context, task } = await shippingFixture();
  const github = githubRunner({ task });
  const result = await actOnTask({
    ...context,
    runner: github.runner,
    id: task.id,
    input: { action: "merge" },
  });
  expect(github.commands.find((command) => command[2] === "merge")).toContain(
    "--match-head-commit",
  );
  expect(github.commands.find((command) => command[2] === "merge")).toContain(
    task.verification?.snapshot.head,
  );
  expect(result.actions[0]?.state).toBe("completed");
  expect(github.commands.flat()).not.toContain("--admin");
}, 15_000);

test("a merge queue request is not reported as a completed merge", async () => {
  const { context, task } = await shippingFixture();
  const github = githubRunner({ task, queued: true });
  const result = await actOnTask({
    ...context,
    runner: github.runner,
    id: task.id,
    input: { action: "merge" },
  });
  expect(result.actions[0]?.state).toBe("pending");
  await expect(
    actOnTask({
      ...context,
      runner: github.runner,
      id: task.id,
      input: { action: "merge" },
    }),
  ).rejects.toThrow("reconciliation");
}, 15_000);

test("stale remote heads and local changes during CI inspection block actions", async () => {
  const { context, task } = await shippingFixture();
  const stale = githubRunner({ task, stale: true });
  expect(
    (await maintainTask({ ...context, runner: stale.runner, id: task.id }))
      .ready,
  ).toBeFalse();
  await expect(
    actOnTask({
      ...context,
      runner: stale.runner,
      id: task.id,
      input: { action: "merge" },
    }),
  ).rejects.toThrow("head differs");
  const racing = githubRunner({
    task,
    beforeChecks: () =>
      Bun.write(
        path.join(context.cwd, "result.txt"),
        "changed during CI lookup\n",
      ).then(() => undefined),
  });
  await expect(
    actOnTask({
      ...context,
      runner: racing.runner,
      id: task.id,
      input: { action: "merge" },
    }),
  ).rejects.toThrow("Workspace changed");
  expect(racing.commands.some((command) => command[2] === "merge")).toBeFalse();
  expect(
    (await readTask({ paths: context.paths, id: task.id })).actions,
  ).toEqual([]);
}, 15_000);

test("an interrupted reply is reconciled by its marker without posting twice", async () => {
  const { context, task } = await shippingFixture();
  const github = githubRunner({ task, failReply: true });
  await expect(
    actOnTask({
      ...context,
      runner: github.runner,
      id: task.id,
      input: {
        action: "pr-reply",
        body: "The verification covers the reported case.",
      },
    }),
  ).rejects.toThrow("reconcile");
  expect(
    (await readTask({ paths: context.paths, id: task.id })).actions[0]?.state,
  ).toBe("uncertain");
  const reconciled = await reconcileTask({
    ...context,
    runner: github.runner,
    id: task.id,
  });
  expect(reconciled.actions[0]?.state).toBe("completed");
  expect(
    github.commands.filter((command) => command[2] === "comment"),
  ).toHaveLength(1);
}, 15_000);
