import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./command";
import { prepareFreshTasks } from "./freshTasks";
import type { ModelCall } from "./types";

async function repositoryFixture() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-additive-task-"),
  );
  await Bun.write(path.join(directory, "parser.ts"), "export const value = 1;\n");
  await command({ arguments: ["git", "init", "--quiet"], cwd: directory });
  await command({ arguments: ["git", "add", "--all"], cwd: directory });
  await command({
    arguments: [
      "git",
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
    cwd: directory,
  });
  return {
    directory,
    commit: await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    }),
  };
}

function response(structured: unknown) {
  return {
    engine: "codex" as const,
    sessionId: "preparation",
    transcriptPath: null,
    text: "",
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

test("generates additive coding work from frozen personal context", async () => {
  const repository = await repositoryFixture();
  let prompt = "";
  let contextInstalled = false;
  const call: ModelCall = async (options) => {
    prompt = options.prompt;
    contextInstalled = await Bun.file(path.join(
      options.cwd,
      ".eval-context/skills/0/clean-code/SKILL.md",
    )).exists();
    return response({
      tasks: [{
        prompt:
          "Create a new parser utility module and focused tests in the utilities package.",
        completion: ["The parser handles empty and populated input"],
        preferences: [
          { requirement: "Use complete names" },
          { requirement: "Keep the public API type safe" },
          { requirement: "Avoid unnecessary comments" },
        ],
      }],
    });
  };
  try {
    const tasks = await prepareFreshTasks({
      repository: repository.directory,
      startingCommit: repository.commit,
      count: 1,
      suppliedTask: undefined,
      profile: "Use complete names.",
      context: [{
        relativePath: "skills/0/clean-code/SKILL.md",
        content: "Keep public APIs type safe.",
      }],
      call,
    });
    expect(contextInstalled).toBeTrue();
    expect(prompt).toContain("Require only new implementation and test files");
    expect(prompt).toContain("Select three to five genuinely applicable");
    expect(tasks[0]?.preferences).toHaveLength(3);
  } finally {
    await rm(repository.directory, { recursive: true, force: true });
  }
});
