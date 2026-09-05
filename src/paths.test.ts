import { expect, test } from "bun:test";
import { createProjectPaths } from "./paths";

test("holds every user path under the selected home directory", () => {
  const paths = createProjectPaths({
    homeDirectory: "/Users/example",
    platform: "darwin",
  });

  expect({
    ...paths,
    runDirectory: paths.runDirectory("run-1"),
    worktreeDirectory: paths.worktreeDirectory("run-1"),
  }).toEqual({
    shadowcloneDirectory: "/Users/example/.shadowclone",
    configFile: "/Users/example/.shadowclone/config.toml",
    indexDatabase: "/Users/example/.shadowclone/index.db",
    profileDirectory: "/Users/example/.shadowclone/profile",
    rejectedProfileFile: "/Users/example/.shadowclone/profile/.rejected",
    profileManifestFile: "/Users/example/.shadowclone/profile/.generated",
    compiledProfileFile: "/Users/example/.shadowclone/profile/.compiled.md",
    distillDirectory: "/Users/example/.shadowclone/distill",
    worktreesDirectory: "/Users/example/.shadowclone/worktrees",
    runsDirectory: "/Users/example/.shadowclone/runs",
    claudeProjectsDirectory: "/Users/example/.claude/projects",
    claudePromptHistoryFile: "/Users/example/.claude/history.jsonl",
    codexSessionsDirectory: "/Users/example/.codex/sessions",
    cursorChatsDirectory: "/Users/example/.cursor/chats",
    shellHistoryFiles: [
      "/Users/example/.zsh_history",
      "/Users/example/.bash_history",
    ],
    managedConfigFile: "/Library/Application Support/shadowclone/managed.json",
    runDirectory: "/Users/example/.shadowclone/runs/run-1",
    worktreeDirectory: "/Users/example/.shadowclone/worktrees/run-1",
  });
});

test("uses the Linux managed policy path on Linux", () => {
  const paths = createProjectPaths({
    homeDirectory: "/home/example",
    platform: "linux",
  });

  expect(paths.managedConfigFile).toBe("/etc/shadowclone/managed.json");
});

test("has no managed policy path on unsupported platforms", () => {
  const paths = createProjectPaths({
    homeDirectory: "C:\\Users\\example",
    platform: "win32",
  });

  expect(paths.managedConfigFile).toBeNull();
});
