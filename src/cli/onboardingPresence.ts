import { opendir } from "node:fs/promises";
import path from "node:path";
import type { ProjectPaths } from "../paths";

export const onboardingCaptureSourceIds = [
  "antigravity",
  "claude-code",
  "claude-prompts",
  "codex",
  "cursor",
  "shell",
] as const;

export type OnboardingCaptureSourceId =
  (typeof onboardingCaptureSourceIds)[number];

export type OnboardingPresence = {
  readonly hasRepositoryGuidance: boolean;
  readonly presentCaptureSources: ReadonlySet<OnboardingCaptureSourceId>;
};

async function directoryHasEntry(directoryPath: string): Promise<boolean> {
  try {
    const directory = await opendir(directoryPath);
    try {
      return (await directory.read()) !== null;
    } finally {
      await directory.close();
    }
  } catch {
    return false;
  }
}

async function fileHasContent(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath);
    return await file.exists() && file.size > 0;
  } catch {
    return false;
  }
}

async function anyFileHasContent(
  filePaths: readonly string[],
): Promise<boolean> {
  return (await Promise.all(filePaths.map(fileHasContent))).some(Boolean);
}

async function hasRepositoryGuidance(
  workingDirectory: string,
): Promise<boolean> {
  const filenames = ["CLAUDE.md", "AGENTS.md", ".cursorrules"];
  const rootFileExists = (
    await Promise.all(
      filenames.map((filename) =>
        Bun.file(path.join(workingDirectory, filename)).exists(),
      ),
    )
  ).some(Boolean);
  if (rootFileExists) {
    return true;
  }
  return (
    await Promise.all([
      directoryHasEntry(path.join(workingDirectory, ".claude", "skills")),
      directoryHasEntry(path.join(workingDirectory, ".agents", "skills")),
    ])
  ).some(Boolean);
}

export async function detectOnboardingPresence(options: {
  readonly paths: ProjectPaths;
  readonly workingDirectory: string;
}): Promise<OnboardingPresence> {
  const results = await Promise.all([
    directoryHasEntry(options.paths.antigravityBrainDirectory),
    directoryHasEntry(options.paths.claudeProjectsDirectory),
    fileHasContent(options.paths.claudePromptHistoryFile),
    directoryHasEntry(options.paths.codexSessionsDirectory),
    directoryHasEntry(options.paths.cursorChatsDirectory),
    anyFileHasContent(options.paths.shellHistoryFiles),
  ]);
  const presentCaptureSources = new Set<OnboardingCaptureSourceId>();
  for (const [sourceIndex, sourceId] of onboardingCaptureSourceIds.entries()) {
    if (results[sourceIndex] === true) {
      presentCaptureSources.add(sourceId);
    }
  }
  return {
    hasRepositoryGuidance: await hasRepositoryGuidance(
      options.workingDirectory,
    ),
    presentCaptureSources,
  };
}
