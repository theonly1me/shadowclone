import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyManagedPolicy,
  defaultConfig,
  defaultManagedPolicy,
  readConfig,
  renderConfig,
  setLiveSessionsEnabled,
  writeConfig,
} from "./index";

test("live sessions stay off in a config that has no remote section", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-config-"));
  const configPath = path.join(directory, "config.toml");

  await Bun.write(configPath, renderConfig(defaultConfig));

  expect((await readConfig({ configPath })).remote?.liveSessions ?? false).toBeFalse();
});

test("turning live sessions on writes remote.live-sessions and reads it back", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-config-"));
  const configPath = path.join(directory, "config.toml");

  await writeConfig({
    configPath,
    config: setLiveSessionsEnabled({ config: defaultConfig, enabled: true }),
  });

  expect(await Bun.file(configPath).text()).toContain("[remote]\nlive-sessions = true");
  expect((await readConfig({ configPath })).remote).toEqual({ liveSessions: true });
});

test("a managed policy below the act tier keeps live sessions off", () => {
  const config = setLiveSessionsEnabled({ config: defaultConfig, enabled: true });

  expect(
    applyManagedPolicy({ config, policy: { ...defaultManagedPolicy, maxActionTier: "draft" } }).remote,
  ).toEqual({ liveSessions: false });
  expect(applyManagedPolicy({ config, policy: defaultManagedPolicy }).remote).toEqual({
    liveSessions: true,
  });
});

test("an unknown key in the remote section fails to parse", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-config-"));
  const configPath = path.join(directory, "config.toml");

  await Bun.write(configPath, `${renderConfig(defaultConfig)}\n[remote]\nlive-session = true\n`);

  await expect(readConfig({ configPath })).rejects.toThrow(
    "Config remote must contain only a live-sessions boolean",
  );
});
