import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import { createProjectPaths } from "../paths";
import { learn } from "./learn";
async function learnInto(targetDirectory: string): Promise<void> {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-learn-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });
  await learn({
    configPath: paths.configFile,
    databasePath: paths.indexDatabase,
    paths,
    targetDirectory,
    managedConfigPath: null,
  });
}

test("does not install the clone into a directory that is not a git work tree", async () => {
  const targetDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-plain-"),
  );

  await learnInto(targetDirectory);

  const agentPath = path.join(
    targetDirectory,
    ".claude",
    "agents",
    "shadowclone.md",
  );
  expect(await Bun.file(agentPath).exists()).toBeFalse();
});

test("installs the clone into a git work tree", async () => {
  const targetDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-repo-"),
  );
  const child = Bun.spawn({
    cmd: ["git", "-C", targetDirectory, "init", "--quiet"],
    stdout: "ignore",
    stderr: "ignore",
  });
  expect(await child.exited).toBe(0);

  await learnInto(targetDirectory);

  const agentPath = path.join(
    targetDirectory,
    ".claude",
    "agents",
    "shadowclone.md",
  );
  expect(await Bun.file(agentPath).exists()).toBeTrue();
});
