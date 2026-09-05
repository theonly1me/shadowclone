import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  defaultConfig,
  readConfig,
  renderConfig,
  sourceIds,
  writeConfig,
} from "./index";

test("defaults every capture source and deep distillation to off", () => {
  for (const sourceId of sourceIds) {
    expect(defaultConfig.sources[sourceId]).toBeFalse();
  }

  expect(defaultConfig.distillation.deep).toBeFalse();
});

test("reads a missing config as the disabled default", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-config-"));
  const configPath = path.join(directory, "missing.toml");

  expect(await readConfig({ configPath })).toEqual(defaultConfig);
});

test("writes and reads the config without changing it", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-config-"));
  const configPath = path.join(directory, "config.toml");
  const config = {
    ...defaultConfig,
    sources: {
      ...defaultConfig.sources,
      "claude-code": true,
    },
  };

  await writeConfig({ config, configPath });

  expect(await readConfig({ configPath })).toEqual(config);
});

test("renders named source settings as TOML", () => {
  expect(renderConfig(defaultConfig)).toBe(
    [
      "schema-version = 1",
      "",
      "[sources]",
      "claude-code = false",
      "claude-prompts = false",
      "codex = false",
      "cursor = false",
      "shell = false",
      "",
      "[distillation]",
      "deep = false",
      "",
    ].join("\n"),
  );
});

test("rejects unknown source names instead of silently enabling them", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-config-"));
  const configPath = path.join(directory, "config.toml");
  const text = renderConfig(defaultConfig).replace(
    "shell = false",
    "shell = false\nbrowser = true",
  );

  await Bun.write(configPath, text);

  await expect(readConfig({ configPath })).rejects.toThrow("no unknown sources");
});
