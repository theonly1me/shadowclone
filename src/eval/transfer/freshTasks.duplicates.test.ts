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

test("rejects duplicate generated tasks after bounded retries", async () => {
  const repository = await repositoryFixture();
  let calls = 0;
  const call: ModelCall = async () => {
    calls += 1;
    return response({
      tasks: ["first", "second"].map(() => ({
        prompt: "Implement the same parser helper.",
        completion: ["The helper works"],
        preferences: [
          { requirement: "Use complete names" },
          { requirement: "Avoid unnecessary comments" },
          { requirement: "Keep each file under 200 lines" },
        ],
      })),
    });
  };
  try {
    await expect(prepareFreshTasks({
      repository: repository.directory,
      startingCommit: repository.commit,
      count: 2,
      suppliedTask: undefined,
      profile: "Use complete names.",
      context: [],
      call,
    })).rejects.toThrow("distinct");
    expect(calls).toBe(3);
  } finally {
    await rm(repository.directory, { recursive: true, force: true });
  }
});
