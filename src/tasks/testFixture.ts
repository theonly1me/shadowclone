import { afterAll } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import { runCommand } from "../dispatch/command";
import { createProjectPaths, canonicalPath } from "../paths";
import { ownedWrite } from "../storage";
import { startTask } from "./start";
import { checkpointTask } from "./checkpoint";
import { verifyTask } from "./verify";
import type { StartTask, TaskRecord } from "./schema";
import type { TaskContext } from "./context";

const directories: string[] = [];
afterAll(async () => {
  for (const directory of directories)
    await rm(directory, { recursive: true, force: true });
});

export async function fixtureGit(options: {
  readonly cwd: string;
  readonly arguments: readonly string[];
}): Promise<string> {
  const result = await runCommand({
    cwd: options.cwd,
    command: ["git", ...options.arguments],
  });
  if (result.exitCode !== 0)
    throw new Error(`Synthetic Git fixture failed: ${options.arguments[0]}`);
  return result.stdout.trim();
}

export async function taskFixture(): Promise<TaskContext> {
  const temporary = canonicalPath(
    await mkdtemp(path.join(os.tmpdir(), "shadowclone-task-test-")),
  );
  directories.push(temporary);
  const cwd = path.join(temporary, "repository");
  await mkdir(cwd);
  await fixtureGit({
    cwd,
    arguments: ["init", "--initial-branch=task-fixture"],
  });
  await fixtureGit({
    cwd,
    arguments: ["config", "user.name", "Synthetic Engineer"],
  });
  await fixtureGit({
    cwd,
    arguments: ["config", "user.email", "engineer@example.invalid"],
  });
  await fixtureGit({
    cwd,
    arguments: [
      "remote",
      "add",
      "origin",
      "https://github.com/synthetic-fixture/task-repository.git",
    ],
  });
  await Bun.write(
    path.join(cwd, "AGENTS.md"),
    "Keep task records outside this repository.\n",
  );
  await Bun.write(path.join(cwd, "result.txt"), "initial\n");
  await fixtureGit({ cwd, arguments: ["add", "."] });
  await fixtureGit({
    cwd,
    arguments: ["commit", "-m", "test: initialize synthetic repository"],
  });
  const paths = createProjectPaths({
    homeDirectory: path.join(temporary, "home"),
    platform: "win32",
  });
  await writeConfig({
    configPath: paths.configFile,
    config: {
      ...defaultConfig,
      sources: { ...defaultConfig.sources, "git-metadata": true },
    },
  });
  return {
    cwd,
    paths,
    execute: async () => ({ exitCode: 0, output: "synthetic check passed" }),
  };
}

export function taskInput(overrides: Partial<StartTask> = {}): StartTask {
  return {
    title: "Write the verified result",
    host: "codex",
    sessionId: "synthetic-owner",
    acceptance: ["The result contains the requested value"],
    scopes: ["."],
    substantive: true,
    finish: "review",
    actions: [],
    verification: [
      {
        name: "result check",
        kind: "cli",
        prerequisites: [],
        setup: [],
        run: ["test -f result.txt"],
        evidence: [],
        cleanup: [],
      },
    ],
    dependencies: [],
    ...overrides,
  };
}

export async function acknowledge(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly sessionId?: string;
  },
): Promise<TaskRecord> {
  return checkpointTask({
    ...options,
    id: options.task.id,
    input: {
      kind: "delivery",
      sessionId: options.sessionId ?? options.task.input.sessionId,
      guidance: options.task.guidance.fingerprint,
      worktree: options.task.worktree,
    },
  });
}

export async function reviewTask(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly sessionId?: string;
  },
): Promise<TaskRecord> {
  const sessionId = options.sessionId ?? "synthetic-reviewer";
  await acknowledge({ ...options, sessionId });
  const snapshot = options.task.verification?.snapshot;
  if (!snapshot) throw new Error("Fixture requires a verification snapshot");
  return checkpointTask({
    ...options,
    id: options.task.id,
    input: {
      kind: "review",
      review: {
        sessionId,
        snapshot: snapshot.fingerprint,
        guidance: options.task.guidance.fingerprint,
        acceptance: options.task.input.acceptance.map((criterion) => ({
          criterion,
          passed: true,
          evidence: "Inspected the synthetic result file and expected value",
        })),
        standards: "The change preserves the repository instructions",
        passed: true,
      },
    },
  });
}

export async function readyTask(
  options: TaskContext & { readonly input?: StartTask },
): Promise<TaskRecord> {
  const task = await startTask({
    ...options,
    input: options.input ?? taskInput(),
  });
  await acknowledge({ ...options, task });
  const verified = await verifyTask({ ...options, id: task.id });
  return reviewTask({ ...options, task: verified });
}

export async function fixtureWorktree(
  options: TaskContext & { readonly name: string },
): Promise<TaskContext> {
  const cwd = path.join(path.dirname(options.cwd), options.name);
  await fixtureGit({
    cwd: options.cwd,
    arguments: ["worktree", "add", "-b", options.name, cwd, "HEAD"],
  });
  return { ...options, cwd };
}

export async function fixtureHarness(context: TaskContext): Promise<void> {
  await ownedWrite({
    path: path.join(context.cwd, ".shadowclone/harness.json"),
    content: JSON.stringify({
      version: 1,
      gate: {
        command: "test -f result.txt",
        source: "synthetic",
        ciRunsGate: false,
      },
      personal: false,
      conventions: [],
      sourceExtensions: [".txt"],
      skills: [],
      ruleKeys: [],
      artifacts: {},
      verification: [],
    }),
  });
}
