import { expect, test } from "bun:test";
import path from "node:path";
import { writeConfig, defaultConfig } from "../config";
import { resolveRepository } from "../signal";
import { installIntegration } from "./install";
import { nativeSessionStart } from "./hooks";
import { integrationFixture } from "./fixtures";
import { integrationHealth } from "./refresh";

test("global pointer stays stable while its hook injects combined guidance", async () => {
  const fixture = await integrationFixture();
  const repository = await resolveRepository({ cwd: fixture.cwd, enabled: false });
  await Bun.write(path.join(fixture.paths.profileDirectory, "org", repository.origin.directoryName, "engineering.md"), "## Local convention\n\nUse the repository's queue.\n");
  const installed = await installIntegration({ ...fixture, agent: "codex", scope: "global" });
  const text = await Bun.file(path.join(fixture.home, ".codex/AGENTS.md")).text();
  expect(text).toContain("native session hook");
  expect(text).not.toContain("Use complete names.");
  expect(text).not.toContain("repository's queue");
  const output = await nativeSessionStart({ ...fixture, id: installed.id, input: JSON.stringify({ cwd: fixture.cwd }) });
  expect(JSON.stringify(output)).toContain("repository's queue");
  expect(JSON.stringify(output)).toContain("Use complete names.");
  expect((await integrationHealth(fixture))[0]).toContain("hook delivery observed");
});

test("Cursor global hooks inject combined context and repository installation suppresses duplicate global delivery", async () => {
  const fixture = await integrationFixture();
  const global = await installIntegration({ ...fixture, agent: "cursor", scope: "global" });
  const input = JSON.stringify({ workspace_roots: [fixture.cwd] });
  expect((await nativeSessionStart({ ...fixture, id: global.id, input })).additional_context).toContain("Use complete names.");
  await installIntegration({ ...fixture, agent: "cursor", scope: "repository" });
  expect(await nativeSessionStart({ ...fixture, id: global.id, input })).toEqual({});
});

test("redacts a profile secret before native hook delivery", async () => {
  const fixture = await integrationFixture();
  const secret = "sk_live_0123456789abcdefghij";
  await Bun.write(path.join(fixture.paths.profileDirectory, "global/engineering.md"), `## Credentials\n\nNever use ${secret}.\n`);
  const installed = await installIntegration({ ...fixture, agent: "claude-code", scope: "repository" });
  const pointer = await Bun.file(path.join(fixture.cwd, "CLAUDE.local.md")).text();
  const output = JSON.stringify(await nativeSessionStart({
    ...fixture,
    id: installed.id,
    input: JSON.stringify({ cwd: fixture.cwd }),
  }));
  expect(pointer).not.toContain(secret);
  expect(output).not.toContain(secret);
  expect(output).toContain("[redacted:");
});

test("Claude subagents receive the profile without opening another learning request", async () => {
  const fixture = await integrationFixture();
  await writeConfig({
    configPath: fixture.paths.configFile,
    config: {
      ...defaultConfig,
      distillation: { deep: true, automatic: true },
    },
  });
  const installed = await installIntegration({
    ...fixture,
    agent: "claude-code",
    scope: "repository",
  });
  const learningPath = path.join(
    fixture.paths.shadowcloneDirectory,
    "session-learning.json",
  );
  const subagent = await nativeSessionStart({
    ...fixture,
    id: installed.id,
    input: JSON.stringify({
      cwd: fixture.cwd,
      session_id: "claude-session",
      hook_event_name: "SubagentStart",
    }),
  });
  const subagentText = JSON.stringify(subagent);
  expect(subagent).toMatchObject({
    hookSpecificOutput: {
      hookEventName: "SubagentStart",
      additionalContext: expect.stringContaining("Use complete names."),
    },
  });
  expect(subagentText).not.toContain("learn --session");
  expect(await Bun.file(learningPath).exists()).toBeFalse();

  const session = await nativeSessionStart({
    ...fixture,
    id: installed.id,
    input: JSON.stringify({
      cwd: fixture.cwd,
      session_id: "claude-session",
      hook_event_name: "SessionStart",
    }),
  });
  const sessionText = JSON.stringify(session);
  expect(session).toMatchObject({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: expect.stringContaining("Use complete names."),
    },
  });
  expect(sessionText).toContain("learn --session");
  expect(await Bun.file(learningPath).exists()).toBeTrue();
});

test("installation leaves capture consent unchanged", async () => {
  const fixture = await integrationFixture();
  await writeConfig({ config: defaultConfig, configPath: fixture.paths.configFile });
  const previous = await Bun.file(fixture.paths.configFile).text();
  await installIntegration({ ...fixture, agent: "claude-code", scope: "repository" });
  expect(await Bun.file(fixture.paths.configFile).text()).toBe(previous);
});

test("Antigravity receives profile context through native hook output", async () => {
  const fixture = await integrationFixture();
  const installed = await installIntegration({
    ...fixture,
    agent: "antigravity",
    scope: "global",
  });
  const hooks = await Bun.file(
    path.join(fixture.home, ".gemini/config/hooks.json"),
  ).text();
  const skill = Bun.file(
    path.join(
      fixture.home,
      ".gemini/config/skills/shadowclone-context/SKILL.md",
    ),
  );
  const output = await nativeSessionStart({
    ...fixture,
    id: installed.id,
    input: JSON.stringify({
      conversationId: "conversation-1",
      workspacePaths: [fixture.cwd],
    }),
  });
  expect(hooks).toContain("PreInvocation");
  expect(hooks).toContain("Stop");
  expect(await skill.exists()).toBeTrue();
  expect(JSON.stringify(output)).toContain("ephemeralMessage");
  expect(JSON.stringify(output)).toContain("Use complete names.");
});
