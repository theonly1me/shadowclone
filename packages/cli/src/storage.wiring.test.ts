import { expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig, createProjectPaths } from "@shadowclone/core";
import { openEventIndex } from "@shadowclone/sessions";
import { doctor } from "./doctor";
import { emptyEnvironment, environmentFile, storeLearningRules, writeEnvironment } from "@shadowclone/environment";
import { learningRecord } from "@shadowclone/environment/testing";

async function scratchPaths(): Promise<ReturnType<typeof createProjectPaths>> {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-wiring-"));

  return createProjectPaths({
    homeDirectory: home,
    platform: process.platform,
  });
}

async function modeOf(target: string): Promise<number> {
  return (await stat(target)).mode & 0o777;
}

test("the config write leaves an owner-only file", async () => {
  const paths = await scratchPaths();

  await writeConfig({ config: defaultConfig, configPath: paths.configFile });

  expect(await modeOf(paths.configFile)).toBe(0o600);
  expect(await modeOf(paths.shadowcloneDirectory)).toBe(0o700);
});

test("the learning store write leaves an owner-only file", async () => {
  const paths = await scratchPaths();

  await writeEnvironment({
    paths,
    state: { ...emptyEnvironment, phase: "active", baselineDirectory: paths.shadowcloneDirectory },
  });
  await storeLearningRules({ paths, rules: [learningRecord().rule] });

  expect(await modeOf(environmentFile(paths))).toBe(0o600);
});

test("the index database is owner-only", async () => {
  const paths = await scratchPaths();

  const index = await openEventIndex(paths.indexDatabase);

  index.close();

  expect(await modeOf(paths.indexDatabase)).toBe(0o600);
  expect(await modeOf(path.dirname(paths.indexDatabase))).toBe(0o700);
});

test("doctor tightens an installation an older version left loose", async () => {
  const paths = await scratchPaths();

  await mkdir(path.join(paths.shadowcloneDirectory, "runs"), {
    recursive: true,
  });
  await writeFile(path.join(paths.shadowcloneDirectory, "config.toml"), "");
  await chmod(paths.shadowcloneDirectory, 0o755);
  await chmod(path.join(paths.shadowcloneDirectory, "runs"), 0o755);
  await chmod(path.join(paths.shadowcloneDirectory, "config.toml"), 0o644);

  await doctor({
    managedConfigPath: null,
    databasePath: paths.indexDatabase,
    shadowcloneDirectory: paths.shadowcloneDirectory,
    probe: async () => false,
  });

  expect(await modeOf(paths.shadowcloneDirectory)).toBe(0o700);
  expect(await modeOf(path.join(paths.shadowcloneDirectory, "runs"))).toBe(
    0o700,
  );
  expect(
    await modeOf(path.join(paths.shadowcloneDirectory, "config.toml")),
  ).toBe(0o600);
});
