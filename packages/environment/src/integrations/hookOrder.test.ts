import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { integrationFixture } from "@shadowclone/core/testing";
import { installIntegration } from "./install";
import { integrationHealth } from "./refresh";

test("a settings file that another tool reordered still reports the Claude hooks as installed", async () => {
  const fixture = await integrationFixture();
  try {
    await installIntegration({ ...fixture, agent: "claude-code", scope: "global" });
    const settingsPath = path.join(fixture.home, ".claude/settings.json");
    const installed: unknown = JSON.parse(await Bun.file(settingsPath).text());
    await Bun.write(settingsPath, `${JSON.stringify({ model: "opus", permissions: { defaultMode: "auto" }, ...Object(installed) }, null, 2)}\n`);

    expect(await integrationHealth(fixture)).toEqual([expect.stringContaining("claude-code (global): installed;")]);
  } finally { await rm(fixture.home, { recursive: true, force: true }); }
});
