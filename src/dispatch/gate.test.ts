import { expect, test } from "bun:test";
import path from "node:path";
import { harnessInitCommand } from "../cli/harness";
import type { EngineRunner } from "../engine";
import { bunTaskList } from "../harness/fixtures/bunTaskList";
import { acceptAll, harnessTestSetup } from "../harness/testFixture";
import type { CommandRunner } from "./command";
import type { GateExecutor } from "./gate";
import { runHeadlessClone } from "./index";

async function gatedRun(options: { readonly gateResults: readonly number[] }) {
  const setup = await harnessTestSetup({ fixture: bunTaskList });
  const runId = "run-gate0001";
  const worktree = setup.paths.worktreeDirectory(runId);

  for (const [relativePath, content] of Object.entries(bunTaskList.files)) {
    await Bun.write(path.join(worktree, relativePath), content);
  }

  await harnessInitCommand({
    apply: true,
    personal: false,
    skills: [],
    enforceClaude: false,
    cwd: worktree,
    paths: setup.paths,
    managedConfigPath: null,
    ask: acceptAll,
    writeLine: () => undefined,
  });

  const commands: string[] = [];
  const commandRunner: CommandRunner = (command) => {
    const text = command.command.join(" ");

    commands.push(text);

    if (text === "git rev-parse --show-toplevel") {
      return Promise.resolve({ exitCode: 0, stdout: `${setup.root}\n` });
    }

    if (text === "git rev-parse HEAD") {
      return Promise.resolve({ exitCode: 0, stdout: "base-commit\n" });
    }

    if (text === "git status --porcelain") {
      return Promise.resolve({ exitCode: 0, stdout: " M src/tasks.ts\n" });
    }

    return Promise.resolve({ exitCode: 0, stdout: "" });
  };

  const prompts: string[] = [];
  const runner: EngineRunner = (run) => {
    prompts.push(run.prompt);

    return Promise.resolve({
      engine: "claude-code",
      sessionId: run.sessionId ?? "session",
      transcriptPath: null,
      text: "",
      structured: null,
      costUsd: 0.1,
      durationMs: 10,
      turns: 2,
      isError: false,
      permissionDenials: [],
      actions: [],
      errorMessage: null,
    });
  };

  const results = [...options.gateResults];
  const gateExecutor: GateExecutor = () =>
    Promise.resolve({
      exitCode: results.shift() ?? 1,
      output: "1 test failed: status filter",
    });

  const receipt = await runHeadlessClone({
    task: "Add a status filter",
    targetDirectory: setup.root,
    configPath: setup.paths.configFile,
    managedConfigPath: null,
    paths: setup.paths,
    runner,
    commandRunner,
    gateExecutor,
    runId,
    startedAt: "2026-09-26T08:00:00.000Z",
  });

  return {
    receipt,
    prompts,
    committed: commands.some((command) => command.startsWith("git commit")),
  };
}

test("a gate that still fails after one repair leaves the change uncommitted", async () => {
  const { receipt, prompts, committed } = await gatedRun({
    gateResults: [1, 1],
  });

  expect(receipt.gate).toEqual({
    status: "failed",
    command: "bun run check",
    attempts: 2,
  });
  expect(prompts).toHaveLength(2);
  expect(prompts[1]).toContain("The repository gate failed after your change.");
  expect(prompts[1]).toContain("1 test failed: status filter");
  expect(committed).toBeFalse();
  expect(receipt.turns).toBe(4);
});

test("a gate that passes after the repair commits the change", async () => {
  const { receipt, prompts, committed } = await gatedRun({
    gateResults: [1, 0],
  });

  expect(receipt.gate).toEqual({
    status: "passed",
    command: "bun run check",
    attempts: 2,
  });
  expect(prompts).toHaveLength(2);
  expect(committed).toBeTrue();
});

test("a gate that passes first time commits without a repair", async () => {
  const { receipt, prompts, committed } = await gatedRun({ gateResults: [0] });

  expect(receipt.gate).toEqual({
    status: "passed",
    command: "bun run check",
    attempts: 1,
  });
  expect(prompts).toHaveLength(1);
  expect(committed).toBeTrue();
});
