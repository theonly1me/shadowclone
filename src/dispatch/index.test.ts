import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import type {
  EngineRunOptions,
  EngineRunner,
} from "../engine";
import { createProjectPaths } from "../paths";
import type { CommandRunner } from "./index";
import { runHeadlessClone } from "./index";

test("runs the engine in a worktree and writes a draft-only receipt", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-dispatch-"),
  );
  const repoDirectory = path.join(homeDirectory, "repo");
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });
  const commands: {
    readonly command: readonly string[];
    readonly cwd: string;
  }[] = [];
  let statusCalls = 0;
  const commandRunner: CommandRunner = (options) => {
    commands.push(options);
    const command = options.command.join(" ");
    if (command === "git rev-parse --show-toplevel") {
      return Promise.resolve({ exitCode: 0, stdout: `${repoDirectory}\n` });
    }
    if (command === "git rev-parse HEAD") {
      return Promise.resolve({ exitCode: 0, stdout: "base-commit\n" });
    }
    if (command === "git status --porcelain") {
      statusCalls += 1;
      return Promise.resolve({
        exitCode: 0,
        stdout: statusCalls === 1 ? " M src/main.ts\n" : "",
      });
    }
    if (command.startsWith("git diff --name-only")) {
      return Promise.resolve({ exitCode: 0, stdout: "src/main.ts\n" });
    }
    if (command.startsWith("git log --format=%H")) {
      return Promise.resolve({ exitCode: 0, stdout: "clone-commit\n" });
    }
    return Promise.resolve({ exitCode: 0, stdout: "" });
  };
  const engineOptions: EngineRunOptions[] = [];
  const runner: EngineRunner = (options) => {
    engineOptions.push(options);
    return Promise.resolve({
      engine: "claude-code",
      sessionId: "run-12345678",
      transcriptPath: null,
      text: "",
      structured: null,
      costUsd: 0.2,
      durationMs: 500,
      turns: 3,
      isError: false,
      permissionDenials: [],
      actions: [],
      errorMessage: null,
    });
  };

  const receipt = await runHeadlessClone({
    task: "Add the focused test",
    targetDirectory: repoDirectory,
    configPath: paths.configFile,
    managedConfigPath: null,
    paths,
    runner,
    commandRunner,
    runId: "run-12345678",
    startedAt: "2026-09-05T08:00:00.000Z",
  });

  const [runOptions] = engineOptions;
  if (!runOptions) {
    throw new Error("Expected the engine to run");
  }
  expect(runOptions.cwd).toBe(paths.worktreeDirectory("run-12345678"));
  expect(runOptions.cwd).not.toBe(repoDirectory);
  expect(runOptions.allowedTools).not.toContain("Bash(git push:*)");
  expect(runOptions.allowedTools).not.toContain("Bash(git commit:*)");
  expect(runOptions.disallowedTools).toContain("Bash(git push:*)");
  expect(receipt.filesChanged).toEqual(["src/main.ts"]);
  expect(receipt.commits).toEqual(["clone-commit"]);
  expect(receipt.actionsTaken).toEqual(["commit"]);
  expect(receipt.actionsBlockedByPolicy).toContain("push");
  expect(
    await Bun.file(
      path.join(paths.runDirectory("run-12345678"), "receipt.json"),
    ).exists(),
  ).toBeTrue();
  const worktreeCommand = commands.find((entry) =>
    entry.command.includes("worktree")
  );
  expect(worktreeCommand?.cwd).toBe(repoDirectory);
  expect(
    commands.some(
      (entry) =>
        entry.command.join(" ") ===
        "git commit -m chore: apply shadowclone task",
    ),
  ).toBeTrue();
});
