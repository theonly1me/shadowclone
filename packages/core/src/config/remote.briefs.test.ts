import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyManagedPolicy,
  defaultConfig,
  defaultManagedPolicy,
  readConfig,
  setLiveSessionsEnabled,
  setTaskBriefsEnabled,
  writeConfig,
} from "./index";

const briefsOn = setTaskBriefsEnabled({
  config: setLiveSessionsEnabled({ config: defaultConfig, enabled: true }),
  enabled: true,
});

test("turning task briefs on writes remote.task-briefs and reads it back", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-config-"));
  const configPath = path.join(directory, "config.toml");

  await writeConfig({ configPath, config: briefsOn });

  expect(await Bun.file(configPath).text()).toContain(
    "[remote]\nlive-sessions = true\ntask-briefs = true\n",
  );
  expect((await readConfig({ configPath })).remote).toEqual({
    liveSessions: true,
    taskBriefs: true,
  });
});

test("task briefs have no effect while live sessions are off", () => {
  const liveOff = { ...briefsOn, remote: { liveSessions: false, taskBriefs: true } };

  expect(applyManagedPolicy({ config: liveOff, policy: defaultManagedPolicy }).remote).toEqual({
    liveSessions: false,
    taskBriefs: false,
  });
});

test("a managed policy that does not allow model generation keeps task briefs off", () => {
  expect(
    applyManagedPolicy({
      config: briefsOn,
      policy: { ...defaultManagedPolicy, distillation: "local-only" },
    }).remote,
  ).toEqual({ liveSessions: true, taskBriefs: false });
  expect(
    applyManagedPolicy({
      config: briefsOn,
      policy: { ...defaultManagedPolicy, maxActionTier: "draft" },
    }).remote,
  ).toEqual({ liveSessions: false, taskBriefs: false });
  expect(applyManagedPolicy({ config: briefsOn, policy: defaultManagedPolicy }).remote).toEqual({
    liveSessions: true,
    taskBriefs: true,
  });
});

test("turning live sessions off also turns task briefs off", () => {
  expect(setLiveSessionsEnabled({ config: briefsOn, enabled: false }).remote).toEqual({
    liveSessions: false,
    taskBriefs: false,
  });
  expect(setLiveSessionsEnabled({ config: briefsOn, enabled: true }).remote).toEqual({
    liveSessions: true,
    taskBriefs: true,
  });
});
