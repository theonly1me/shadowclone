import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import { detectOnboardingPresence } from "./onboardingPresence";

test("reduces a rules file and one populated source to booleans", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-presence-"),
  );
  const workingDirectory = path.join(homeDirectory, "project");
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await Promise.all([
    mkdir(workingDirectory, { recursive: true }),
    mkdir(paths.claudeProjectsDirectory, { recursive: true }),
    mkdir(paths.codexSessionsDirectory, { recursive: true }),
  ]);
  await Promise.all([
    Bun.write(path.join(workingDirectory, "CLAUDE.md"), "fixture"),
    Bun.write(
      path.join(paths.claudeProjectsDirectory, "private-project.jsonl"),
      "fixture",
    ),
  ]);

  const presence = await detectOnboardingPresence({ paths, workingDirectory });

  expect(presence.hasRepositoryGuidance).toBeTrue();
  expect([...presence.presentCaptureSources]).toEqual(["claude-code"]);
  expect(Object.keys(presence).sort()).toEqual([
    "hasRepositoryGuidance",
    "presentCaptureSources",
  ]);
});

test("detects non-empty file sources without returning their metadata", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-presence-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const [shellHistoryFile] = paths.shellHistoryFiles;
  if (!shellHistoryFile) {
    throw new Error("Test paths need one shell history file");
  }
  await Promise.all([
    Bun.write(paths.claudePromptHistoryFile, "fixture"),
    Bun.write(shellHistoryFile, "fixture"),
  ]);

  const presence = await detectOnboardingPresence({
    paths,
    workingDirectory: homeDirectory,
  });

  expect([...presence.presentCaptureSources]).toEqual([
    "claude-prompts",
    "shell",
  ]);
});

test("reduces a non-empty repository skill root to one boolean", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-presence-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const skillPath = path.join(
    homeDirectory,
    ".agents",
    "skills",
    "private-skill",
    "SKILL.md",
  );
  await mkdir(path.dirname(skillPath), { recursive: true });
  await Bun.write(skillPath, "fixture");

  const presence = await detectOnboardingPresence({
    paths,
    workingDirectory: homeDirectory,
  });

  expect(presence.hasRepositoryGuidance).toBeTrue();
  expect(Object.keys(presence)).toEqual([
    "hasRepositoryGuidance",
    "presentCaptureSources",
  ]);
});

test("ignores similar rules filenames and empty source directories", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-presence-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await mkdir(paths.cursorChatsDirectory, { recursive: true });
  await Bun.write(path.join(homeDirectory, "CLAUDE.mdx"), "fixture");

  const presence = await detectOnboardingPresence({
    paths,
    workingDirectory: homeDirectory,
  });

  expect(presence.hasRepositoryGuidance).toBeFalse();
  expect(presence.presentCaptureSources.size).toBe(0);
});
