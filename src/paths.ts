import os from "node:os";
import path from "node:path";

export type ProjectPaths = {
  readonly shadowcloneDirectory: string;
  readonly configFile: string;
  readonly indexDatabase: string;
  readonly profileDirectory: string;
  readonly rejectedProfileFile: string;
  readonly profileManifestFile: string;
  readonly compiledProfileFile: string;
  readonly distillDirectory: string;
  readonly worktreesDirectory: string;
  readonly runsDirectory: string;
  readonly antigravityBrainDirectory: string;
  readonly claudeProjectsDirectory: string;
  readonly claudePromptHistoryFile: string;
  readonly codexSessionsDirectory: string;
  readonly cursorChatsDirectory: string;
  readonly shellHistoryFiles: readonly string[];
  readonly managedConfigFile: string | null;
  readonly runDirectory: (runId: string) => string;
  readonly worktreeDirectory: (runId: string) => string;
};

function getManagedConfigFile(platform: NodeJS.Platform): string | null {
  if (platform === "darwin") {
    return "/Library/Application Support/shadowclone/managed.json";
  }

  if (platform === "linux") {
    return "/etc/shadowclone/managed.json";
  }

  return null;
}

export function createProjectPaths(options: {
  readonly homeDirectory: string;
  readonly platform: NodeJS.Platform;
}): ProjectPaths {
  const shadowcloneDirectory = path.join(options.homeDirectory, ".shadowclone");
  const profileDirectory = path.join(shadowcloneDirectory, "profile");

  return {
    shadowcloneDirectory,
    configFile: path.join(shadowcloneDirectory, "config.toml"),
    indexDatabase: path.join(shadowcloneDirectory, "index.db"),
    profileDirectory,
    rejectedProfileFile: path.join(profileDirectory, ".rejected"),
    profileManifestFile: path.join(profileDirectory, ".generated"),
    compiledProfileFile: path.join(profileDirectory, ".compiled.md"),
    distillDirectory: path.join(shadowcloneDirectory, "distill"),
    worktreesDirectory: path.join(shadowcloneDirectory, "worktrees"),
    runsDirectory: path.join(shadowcloneDirectory, "runs"),
    antigravityBrainDirectory: path.join(
      options.homeDirectory,
      ".gemini",
      "antigravity-cli",
      "brain",
    ),
    claudeProjectsDirectory: path.join(options.homeDirectory, ".claude", "projects"),
    claudePromptHistoryFile: path.join(options.homeDirectory, ".claude", "history.jsonl"),
    codexSessionsDirectory: path.join(options.homeDirectory, ".codex", "sessions"),
    cursorChatsDirectory: path.join(options.homeDirectory, ".cursor", "chats"),
    shellHistoryFiles: [
      path.join(options.homeDirectory, ".zsh_history"),
      path.join(options.homeDirectory, ".bash_history"),
    ],
    managedConfigFile: getManagedConfigFile(options.platform),
    runDirectory: (runId) => path.join(shadowcloneDirectory, "runs", runId),
    worktreeDirectory: (runId) =>
      path.join(shadowcloneDirectory, "worktrees", runId),
  };
}

export const projectPaths = createProjectPaths({
  homeDirectory: os.homedir(),
  platform: process.platform,
});
