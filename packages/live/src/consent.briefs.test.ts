import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { defaultConfig, setLiveSessionsEnabled, writeConfig } from "@shadowclone/core";
import { liveConsent, switchLiveSessions, switchTaskBriefs } from "./consent";
import { hookContext, hookInput, temporaryHome } from "./fixtures";
import { handleLiveHook } from "./hook";
import type { LivePaths } from "./paths";
import { liveId } from "./record";
import { listRecords } from "./store";

const sessionIds = ["first-session", "second-session"];

async function sessionsWithTasks(options: { readonly paths: LivePaths }): Promise<void> {
  const context = hookContext({ paths: options.paths, startedWriters: [] });

  for (const sessionId of sessionIds) {
    await handleLiveHook({
      context,
      input: hookInput("UserPromptSubmit", { session_id: sessionId, prompt: "Rename the parser." }),
    });
  }
}

describe("the task briefs switch", () => {
  test("enable refuses while live sessions are off, and leaves the config alone", async () => {
    const { home, paths, remove } = await temporaryHome();
    const configPath = path.join(home, "config.toml");

    try {
      const outcome = await switchTaskBriefs({ paths, enabled: true, configPath, managedConfigPath: null });

      expect(outcome).toEqual({
        kind: "refused",
        reason: "Live sessions are off, so task briefs cannot start. Run shadowclone live enable first.",
      });
      expect(await Bun.file(configPath).exists()).toBe(false);
    } finally {
      await remove();
    }
  });

  test("disable turns the flag off and deletes each task file, and keeps the session records", async () => {
    const { home, paths, remove } = await temporaryHome();
    const configPath = path.join(home, "config.toml");
    const location = { configPath, managedConfigPath: null };

    try {
      await writeConfig({ configPath, config: setLiveSessionsEnabled({ config: defaultConfig, enabled: true }) });

      expect(await switchTaskBriefs({ paths, enabled: true, ...location })).toEqual({ kind: "on" });
      expect(await liveConsent(location)).toEqual({ liveSessions: true, taskBriefs: true });

      await sessionsWithTasks({ paths });
      await Bun.write(path.join(paths.directory, `${liveId({ engine: "claude", sessionId: "first-session" })}.brief.json`), "{}");

      expect(await switchTaskBriefs({ paths, enabled: false, ...location })).toEqual({
        kind: "off",
        removedSessions: 2,
      });
      expect(await liveConsent(location)).toEqual({ liveSessions: true, taskBriefs: false });
      expect((await readdir(paths.directory)).sort()).toEqual(
        sessionIds.map((sessionId) => `${liveId({ engine: "claude", sessionId })}.json`).sort(),
      );
    } finally {
      await remove();
    }
  });

  test("live disable deletes each task file and turns task briefs off", async () => {
    const { home, paths, remove } = await temporaryHome();
    const configPath = path.join(home, "config.toml");
    const location = { configPath, managedConfigPath: null };

    try {
      await switchLiveSessions({ paths, enabled: true, configPath });
      await switchTaskBriefs({ paths, enabled: true, ...location });
      await sessionsWithTasks({ paths });

      expect(await liveConsent(location)).toEqual({ liveSessions: true, taskBriefs: true });
      expect(await readdir(paths.directory)).toContain(
        `${liveId({ engine: "claude", sessionId: "first-session" })}.task.json`,
      );

      await switchLiveSessions({ paths, enabled: false, configPath });

      expect(await readdir(paths.directory).catch(() => [])).toEqual([]);
      expect(await liveConsent(location)).toEqual({ liveSessions: false, taskBriefs: false });
      expect(await Bun.file(configPath).text()).not.toContain("task-briefs");
    } finally {
      await remove();
    }
  });

  test("an ended session loses its task file with its record after one day", async () => {
    const { paths, remove } = await temporaryHome();

    try {
      await sessionsWithTasks({ paths });
      await handleLiveHook({
        context: hookContext({ paths, startedWriters: [] }),
        input: hookInput("SessionEnd", { session_id: "first-session" }),
      });

      const kept = await listRecords({ paths, now: new Date("2026-10-19T11:00:00Z") });
      const afterOneDay = await listRecords({ paths, now: new Date("2026-10-19T12:00:01Z") });
      const second = liveId({ engine: "claude", sessionId: "second-session" });

      expect(kept).toHaveLength(2);
      expect(afterOneDay.map((record) => record.id)).toEqual([second]);
      expect((await readdir(paths.directory)).sort()).toEqual([`${second}.json`, `${second}.task.json`]);
    } finally {
      await remove();
    }
  });
});
