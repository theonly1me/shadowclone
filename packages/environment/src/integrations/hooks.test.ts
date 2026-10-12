import { expect, test } from "bun:test";
import path from "node:path";
import { writeConfig, defaultConfig } from "@shadowclone/core";
import { installIntegration } from "./install";
import { nativeSessionStart } from "./hooks";
import { integrationFixture } from "@shadowclone/core/testing";
import { writeActiveEnvironment } from "../environment/fixtures";

test("redacts a learned secret before it reaches the native instructions", async () => {
  const fixture = await integrationFixture();
  const secret = ["sk", "live", "0123456789abcdefghij"].join("_");

  await writeActiveEnvironment({ ...fixture, bodies: [`Never use ${secret}.`] });
  await installIntegration({
    ...fixture,
    agent: "claude-code",
    scope: "global",
  });

  const instructions = await Bun.file(
    path.join(fixture.home, ".claude/CLAUDE.md"),
  ).text();

  expect(instructions).toContain("# shadowclone guidance");
  expect(instructions).not.toContain(secret);
});

test("session hooks deliver the learned routing without learning instructions", async () => {
  const fixture = await integrationFixture();

  await writeConfig({
    configPath: fixture.paths.configFile,
    config: { ...defaultConfig, distillation: { deep: true, automatic: true } },
  });
  await writeActiveEnvironment({ ...fixture, bodies: ["Use complete names."] });

  const installed = await installIntegration({
    ...fixture,
    agent: "cursor",
    scope: "global",
  });
  const text = JSON.stringify(
    await nativeSessionStart({
      ...fixture,
      id: installed.id,
      input: JSON.stringify({ workspace_roots: [fixture.cwd], conversation_id: "cursor-session" }),
    }),
  );

  expect(text).toContain("Use complete names.");
  expect(text).not.toContain("learn --session");
  expect(
    await Bun.file(
      path.join(fixture.paths.shadowcloneDirectory, "session-learning.json"),
    ).exists(),
  ).toBeFalse();
});

test("no skills environment produces no native hook output", async () => {
  const fixture = await integrationFixture();

  const installed = await installIntegration({
    ...fixture,
    agent: "claude-code",
    scope: "repository",
  });
  const output = await nativeSessionStart({
    ...fixture,
    id: installed.id,
    input: JSON.stringify({
      cwd: fixture.cwd,
      session_id: "claude-session",
      hook_event_name: "SessionStart",
    }),
  });

  expect(output).toEqual({});
});

test("installation leaves capture consent unchanged", async () => {
  const fixture = await integrationFixture();

  await writeConfig({
    config: defaultConfig,
    configPath: fixture.paths.configFile,
  });

  const previous = await Bun.file(fixture.paths.configFile).text();

  await installIntegration({
    ...fixture,
    agent: "claude-code",
    scope: "repository",
  });

  expect(await Bun.file(fixture.paths.configFile).text()).toBe(previous);
});
