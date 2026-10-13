import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createProjectPaths, defaultConfig, writeConfig } from "@shadowclone/core";
import { integrationFixture } from "@shadowclone/core/testing";
import { writeActiveEnvironment } from "../environment/fixtures";
import { recordLearningNotice } from "../environment/learningNotice";
import { nativeSessionEnd, nativeSessionStart } from "./hooks";
import { installIntegration, uninstallIntegration } from "./install";

test("OpenCode installs its global section, plugin, and shared skill and removes only what it owns", async () => {
  const fixture = await integrationFixture();
  const configDirectory = path.join(fixture.home, ".config/opencode");
  const instructions = path.join(configDirectory, "AGENTS.md");
  const teamInstructions = path.join(fixture.cwd, "AGENTS.md");

  await Bun.write(instructions, "Manual OpenCode guidance\n");
  await Bun.write(teamInstructions, "Team guidance\n");
  await writeActiveEnvironment({ ...fixture, bodies: ["Use complete names."] });

  try {
    const global = await installIntegration({ ...fixture, agent: "opencode", scope: "global" });
    const local = await installIntegration({ ...fixture, agent: "opencode", scope: "repository" });

    expect(global.directory).toBe(configDirectory);
    expect(await Bun.file(instructions).text()).toContain("Manual OpenCode guidance");
    expect(await Bun.file(instructions).text()).toContain("Use complete names.");
    expect(await Bun.file(path.join(configDirectory, "plugins/shadowclone.js")).text()).toContain(
      "experimental.chat.system.transform",
    );
    expect(
      await Bun.file(path.join(fixture.cwd, ".opencode/plugins/shadowclone.js")).exists(),
    ).toBeTrue();
    expect(
      await Bun.file(
        path.join(fixture.home, ".agents/skills/shadowclone-context/SKILL.md"),
      ).exists(),
    ).toBeTrue();
    expect(await Bun.file(teamInstructions).text()).toBe("Team guidance\n");

    await uninstallIntegration({ paths: fixture.paths, integration: local });
    await uninstallIntegration({ paths: fixture.paths, integration: global });

    expect(await Bun.file(instructions).text()).toBe("Manual OpenCode guidance\n");
    expect(
      await Bun.file(path.join(configDirectory, "plugins/shadowclone.js")).exists(),
    ).toBeFalse();
    expect(
      await Bun.file(path.join(fixture.cwd, ".opencode/plugins/shadowclone.js")).exists(),
    ).toBeFalse();
    expect(await Bun.file(teamInstructions).text()).toBe("Team guidance\n");
  } finally {
    await rm(fixture.home, { recursive: true, force: true });
  }
});

test("a global OpenCode install follows OPENCODE_CONFIG_DIR", async () => {
  const fixture = await integrationFixture();
  const configDirectory = path.join(fixture.home, "custom-opencode");
  const paths = createProjectPaths({
    homeDirectory: fixture.home,
    platform: "darwin",
    opencode: { configDirectory },
  });

  try {
    await installIntegration({ ...fixture, paths, agent: "opencode", scope: "global" });

    expect(
      await Bun.file(path.join(configDirectory, "plugins/shadowclone.js")).exists(),
    ).toBeTrue();
    expect(
      await Bun.file(path.join(fixture.home, ".config/opencode/plugins/shadowclone.js")).exists(),
    ).toBeFalse();
  } finally {
    await rm(fixture.home, { recursive: true, force: true });
  }
});

test("OpenCode session start returns plain context, and session end needs OpenCode capture consent", async () => {
  const fixture = await integrationFixture();

  await writeActiveEnvironment({ ...fixture, bodies: ["Use complete names."] });

  try {
    const local = await installIntegration({ ...fixture, agent: "opencode", scope: "repository" });
    const global = await installIntegration({ ...fixture, agent: "opencode", scope: "global" });
    const elsewhere = JSON.stringify({ cwd: fixture.home, session_id: "ses_synthetic" });
    const repository = JSON.stringify({ cwd: fixture.cwd, session_id: "ses_synthetic" });

    await recordLearningNotice({
      paths: fixture.paths,
      applied: ["Use complete parameter names"],
      discarded: [],
      revisions: ["synthetic-revision"],
    });

    const started = await nativeSessionStart({ ...fixture, id: global.id, input: elsewhere });

    expect(Object.keys(started)).toEqual(["additionalContext"]);
    expect(JSON.stringify(started)).toContain("Use complete parameter names");
    expect(await nativeSessionEnd({ ...fixture, id: local.id, input: repository })).toBeNull();

    await writeConfig({
      configPath: fixture.paths.configFile,
      config: { ...defaultConfig, sources: { ...defaultConfig.sources, opencode: true } },
    });

    expect(await nativeSessionEnd({ ...fixture, id: global.id, input: repository })).toBeNull();
    expect(await nativeSessionEnd({ ...fixture, id: local.id, input: repository })).toBeString();
  } finally {
    await rm(fixture.home, { recursive: true, force: true });
  }
});
