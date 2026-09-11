import type { ProjectPaths } from "../paths";

export function captureRoots(paths: ProjectPaths): readonly string[] {
  return [
    paths.antigravityBrainDirectory,
    paths.claudeProjectsDirectory,
    paths.claudePromptHistoryFile,
    paths.codexSessionsDirectory,
    paths.cursorChatsDirectory,
    ...paths.shellHistoryFiles,
  ];
}
