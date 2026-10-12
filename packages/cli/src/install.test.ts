import { expect, test } from "bun:test";
import { runHostCommand, defaultConfig, writeConfig, createProjectPaths } from "@shadowclone/core";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installLiveClone } from "./install";
import { writeActiveEnvironment } from "@shadowclone/environment/testing";

test("installs the learned routing as a Claude subagent", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-install-"),
  );
  const targetDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-repo-"),
  );

  await runHostCommand({
    arguments: ["git", "init", "--quiet"],
    cwd: targetDirectory,
  });

  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });

  await writeConfig({ config: defaultConfig, configPath: paths.configFile });

  await writeActiveEnvironment({
    paths,
    home: homeDirectory,
    bodies: ["Show the plan before changing files."],
  });

  await installLiveClone({
    cwd: targetDirectory,
    configPath: paths.configFile,
    paths,
    managedConfigPath: null,
  });

  const agentPath = path.join(
    targetDirectory,
    ".claude",
    "agents",
    "shadowclone.md",
  );
  const agent = await Bun.file(agentPath).text();

  expect(agent).toContain("name: shadowclone");
  expect(agent).toContain("- Show the plan before changing files.");
});

test("adds installed files to git info exclude", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-install-"),
  );
  const targetDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-repo-"),
  );
  const init = Bun.spawn({
    cmd: ["git", "-C", targetDirectory, "init"],
    stdout: "ignore",
    stderr: "ignore",
  });

  expect(await init.exited).toBe(0);

  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });

  await writeConfig({ config: defaultConfig, configPath: paths.configFile });

  await installLiveClone({
    cwd: targetDirectory,
    configPath: paths.configFile,
    paths,
    managedConfigPath: null,
    autoDelegate: true,
  });

  const excludePath = path.join(targetDirectory, ".git", "info", "exclude");
  const content = await Bun.file(excludePath).text();

  expect(content).toContain(".claude/agents/shadowclone.md");
  expect(content).toContain(".claude/skills/shadowclone/");
});
