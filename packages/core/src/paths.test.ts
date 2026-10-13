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
    installationsFile: "/Users/example/.shadowclone/installations.json",
    distillDirectory: "/Users/example/.shadowclone/distill",
    worktreesDirectory: "/Users/example/.shadowclone/worktrees",
    runsDirectory: "/Users/example/.shadowclone/runs",
    antigravityBrainDirectory: "/Users/example/.gemini/antigravity-cli/brain",
    antigravityWorkspaceHistoryFile:
      "/Users/example/.gemini/antigravity-cli/history.jsonl",
    claudeProjectsDirectory: "/Users/example/.claude/projects",
    claudePromptHistoryFile: "/Users/example/.claude/history.jsonl",
    codexSessionsDirectory: "/Users/example/.codex/sessions",
    cursorChatsDirectory: "/Users/example/.cursor/chats",
    piAgentDirectory: "/Users/example/.pi/agent",
    piSessionsDirectory: "/Users/example/.pi/agent/sessions",
    opencodeConfigDirectory: "/Users/example/.config/opencode",
    opencodeDataDirectory: "/Users/example/.local/share/opencode",
    opencodeDatabaseFile: "/Users/example/.local/share/opencode/opencode.db",
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

test("follows the OpenCode configuration and data overrides", () => {
  const paths = createProjectPaths({
    homeDirectory: "/home/example",
    platform: "linux",
    opencode: { configHome: "/xdg/config", dataHome: "/xdg/data", databaseFile: "custom.db" },
  });

  expect(paths.opencodeConfigDirectory).toBe("/xdg/config/opencode");
  expect(paths.opencodeDatabaseFile).toBe("/xdg/data/opencode/custom.db");
});

test("prefers the OpenCode configuration folder and an absolute database file", () => {
  const paths = createProjectPaths({
    homeDirectory: "/home/example",
    platform: "linux",
    opencode: {
      configDirectory: "/custom/opencode-config",
      configHome: "/xdg/config",
      databaseFile: "/elsewhere/sessions.db",
    },
  });

  expect(paths.opencodeConfigDirectory).toBe("/custom/opencode-config");
  expect(paths.opencodeDatabaseFile).toBe("/elsewhere/sessions.db");
});
