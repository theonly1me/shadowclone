import { expect, test } from "bun:test";
import path from "node:path";
import { installIntegration } from "./install";
import { nativeSessionStart } from "./hooks";
import { integrationFixture } from "@shadowclone/core/testing";
import { writeActiveEnvironment } from "../environment/fixtures";
import { integrationHealth } from "./refresh";

test("a global Codex install writes the global routing to its instructions", async () => {
  const fixture = await integrationFixture();

  await writeActiveEnvironment({ ...fixture, bodies: ["Use complete names."] });

  const installed = await installIntegration({
    ...fixture,
    agent: "codex",
    scope: "global",
  });
  const text = await Bun.file(
    path.join(fixture.home, ".codex/AGENTS.md"),
  ).text();

  expect(text).toContain("Use complete names.");
  expect(installed.agent).toBe("codex");
});

test("Cursor global hooks inject combined context and repository installation suppresses duplicate global delivery", async () => {
  const fixture = await integrationFixture();

  await writeActiveEnvironment({ ...fixture, bodies: ["Use complete names."] });
  const global = await installIntegration({
    ...fixture,
    agent: "cursor",
    scope: "global",
  });
  const input = JSON.stringify({ workspace_roots: [fixture.cwd] });

  expect(
    (await nativeSessionStart({ ...fixture, id: global.id, input }))
      .additional_context,
  ).toContain("Use complete names.");
  expect((await integrationHealth(fixture))[0]).toContain(
    "hook delivery observed",
  );

  await installIntegration({
    ...fixture,
    agent: "cursor",
    scope: "repository",
  });

  expect(
    await nativeSessionStart({ ...fixture, id: global.id, input }),
  ).toEqual({});
});

test("Antigravity receives the learned routing through native hook output", async () => {
  const fixture = await integrationFixture();

  await writeActiveEnvironment({ ...fixture, bodies: ["Use complete names."] });
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
