import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CommandRunner } from "./command";
import { executeRemoteActions } from "./remoteActions";

test("PR reply draft cannot select another repository or inject shell arguments", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-remote-"),
  );
  try {
    const recorded: string[][] = [];
    const runner: CommandRunner = async ({ command }) => {
      recorded.push([...command]);
      return { exitCode: 0, stdout: "" };
    };
    const body = "Literal $(touch outside) and `command` text";
    const completed = await executeRemoteActions({
      granted: ["pr-reply"],
      repositoryId: "github.com/example/project",
      worktree: {
        repoDirectory: directory,
        worktreeDirectory: directory,
        baseCommit: "base",
        branch: "shadowclone/task-1",
      },
      runDirectory: directory,
      structured: { title: "Review", body },
      pullRequestNumber: 123,
      runner,
    });
    expect(completed).toEqual(["pr-reply"]);
    expect(recorded[0]).toEqual([
      "gh",
      "pr",
      "comment",
      "123",
      "--repo",
      "github.com/example/project",
      "--body-file",
      path.join(directory, "remote-body.md"),
    ]);
    expect(await Bun.file(path.join(directory, "remote-body.md")).text()).toBe(
      body,
    );
    expect(
      await Bun.file(path.join(directory, "outside")).exists(),
    ).toBeFalse();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
