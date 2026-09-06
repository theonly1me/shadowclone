import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import { createProjectPaths } from "../paths";
import { writeProfile } from "../profile";
import { resolveCwdOrigin } from "../signal";
import { installLiveClone } from "./install";

test("installs the scoped profile as a Claude subagent", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-install-"),
  );
  const targetDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-repo-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });
  const origin = await resolveCwdOrigin({
    cwd: targetDirectory,
    enabled: false,
  });
  await writeProfile({
    paths,
    rules: [
      {
        key: "plan-first",
        title: "Plans before editing",
        body: "Show the plan before changing files.",
        section: "workflow",
        scope: "org",
        originDirectory: origin.directoryName,
        observations: 3,
        confidence: 1,
        lastSeen: "2026-09-05",
        sessions: 2,
        origins: [origin.id],
      },
    ],
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
  expect(agent).toContain("Plans before editing");
  expect(agent).not.toContain("<!-- shadowclone:");
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
  });

  const excludePath = path.join(targetDirectory, ".git", "info", "exclude");
  const content = await Bun.file(excludePath).text();
  expect(content).toContain(".claude/agents/shadowclone.md");
  expect(content).toContain(".claude/skills/shadowclone/");
});
