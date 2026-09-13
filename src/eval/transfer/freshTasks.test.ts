import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareFreshTasks } from "./freshTasks";
import type { ModelCall } from "./types";

async function git(options: {
  readonly directory: string;
  readonly arguments: readonly string[];
}): Promise<string> {
  const child = Bun.spawn({
    cmd: ["git", ...options.arguments],
    cwd: options.directory,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(error);
  }
  return output.trim();
}

async function repositoryFixture(): Promise<{
  readonly directory: string;
  readonly commit: string;
}> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-fresh-task-"),
  );
  await Bun.write(path.join(directory, "parser.ts"), "export const value = 1;\n");
  await git({ directory, arguments: ["init", "--quiet"] });
  await git({ directory, arguments: ["add", "--all"] });
  await git({
    directory,
    arguments: [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@localhost",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
  });
  return {
    directory,
    commit: await git({ directory, arguments: ["rev-parse", "HEAD"] }),
  };
}

function response(structured: unknown) {
  return {
    engine: "codex" as const,
    sessionId: "preparation",
    transcriptPath: null,
    text: "not structured output",
    structured,
    costUsd: null,
    durationMs: 1,
    turns: 1,
    actions: [],
    permissionDenials: [],
    isError: false,
    errorMessage: null,
  };
}

test("prepares a supplied fresh task from HEAD without rewriting it", async () => {
  const repository = await repositoryFixture();
  const accesses: string[] = [];
  const suppliedTask = "Add a parser helper and tests.";
  const call: ModelCall = async (options) => {
    accesses.push(options.access ?? "none");
    return response({
      tasks: [{
        prompt: "A rewritten prompt",
        completion: ["The parser helper is covered by tests"],
        preferenceSources: ["profile.md"],
      }],
    });
  };
  try {
    const tasks = await prepareFreshTasks({
      repository: repository.directory,
      startingCommit: repository.commit,
      count: 1,
      suppliedTask,
      profile: "Use complete variable names.",
      context: [],
      call,
    });
    expect(tasks[0]?.prompt).toBe(suppliedTask);
    expect(tasks[0]?.startingCommit).toBe(repository.commit);
    expect(accesses).toEqual(["read"]);
  } finally {
    await rm(repository.directory, { recursive: true, force: true });
  }
});

test("rejects externally dependent generated tasks after bounded retries", async () => {
  const repository = await repositoryFixture();
  let calls = 0;
  const call: ModelCall = async () => {
    calls += 1;
    return response({
      tasks: [{
        prompt: "Update the Staging OAuth resources.",
        completion: ["The Staging service returns the new resources"],
        preferenceSources: ["profile.md"],
      }],
    });
  };
  try {
    await expect(prepareFreshTasks({
      repository: repository.directory,
      startingCommit: repository.commit,
      count: 1,
      suppliedTask: undefined,
      profile: "Keep changes scoped.",
      context: [],
      call,
    })).rejects.toThrow("forbidden external or permanent action");
    expect(calls).toBe(3);
  } finally {
    await rm(repository.directory, { recursive: true, force: true });
  }
});

test("rejects a supplied task that requires a permanent action", async () => {
  const repository = await repositoryFixture();
  let calls = 0;
  const call: ModelCall = async () => {
    calls += 1;
    return response({
      tasks: [{
        prompt: "A safe rewritten task",
        completion: ["The release is available"],
        preferenceSources: ["profile.md"],
      }],
    });
  };
  try {
    await expect(prepareFreshTasks({
      repository: repository.directory,
      startingCommit: repository.commit,
      count: 1,
      suppliedTask: "Deploy the current release to production.",
      profile: "Keep changes scoped.",
      context: [],
      call,
    })).rejects.toThrow("forbidden external or permanent action");
    expect(calls).toBe(3);
  } finally {
    await rm(repository.directory, { recursive: true, force: true });
  }
});
