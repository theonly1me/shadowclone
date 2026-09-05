import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  defaultConfig,
  setSourceEnabled,
  writeConfig,
} from "../config";
import { openEventIndex } from "../index";
import { createProjectPaths } from "../paths";
import { writeProfile } from "../profile";
import { resolveCwdOrigin } from "../signal";
import {
  getSessionStartContext,
  runSessionEndHook,
} from "./hooks";

test("the session hook does not inspect input for a disabled source", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-hook-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });

  await expect(
    runSessionEndHook({
      input: "not json and not a path",
      configPath: paths.configFile,
      paths,
      managedConfigPath: null,
    }),
  ).resolves.toBeUndefined();
});

test("the session hook ingests only its enabled transcript", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-hook-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  const transcriptDirectory = path.join(
    paths.claudeProjectsDirectory,
    "fixture",
  );
  await mkdir(transcriptDirectory, { recursive: true });
  const sourcePath = path.join(transcriptDirectory, "session.jsonl");
  await Bun.write(
    sourcePath,
    `${JSON.stringify({
      type: "user",
      sessionId: "session",
      uuid: "event",
      cwd: "/repo",
      message: { id: "message", content: "Use the narrow scope" },
    })}\n`,
  );
  const config = setSourceEnabled({
    config: defaultConfig,
    source: "claude-code",
    enabled: true,
  });
  await writeConfig({ config, configPath: paths.configFile });

  await runSessionEndHook({
    input: JSON.stringify({ transcript_path: sourcePath }),
    configPath: paths.configFile,
    paths,
    managedConfigPath: null,
  });

  const index = await openEventIndex(paths.indexDatabase);
  expect(index.countEvents()).toBe(1);
  index.close();
});

test("the session context keeps learned boundaries advisory", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-boundary-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });
  const origin = await resolveCwdOrigin({
    cwd: homeDirectory,
    enabled: false,
  });
  await writeProfile({
    paths,
    rules: [
      {
        key: "deny-bash",
        title: "Requests confirmation after refusing Bash",
        body: "Ask before repeating a similar Bash action.",
        section: "boundaries",
        scope: "org",
        originDirectory: origin.directoryName,
        observations: 2,
        confidence: 1,
        lastSeen: "2026-09-05",
        sessions: 1,
        origins: [origin.id],
      },
    ],
  });

  const context = await getSessionStartContext({
    input: JSON.stringify({ cwd: homeDirectory }),
    configPath: paths.configFile,
    paths,
    managedConfigPath: null,
  });

  expect(context?.hookSpecificOutput.additionalContext).toContain(
    "Requests confirmation after refusing Bash",
  );
});

test("the plugin registers no tool-family blocking hook", async () => {
  const hooks = await Bun.file(
    new URL("../../.claude-plugin/hooks/hooks.json", import.meta.url),
  ).text();

  expect(hooks).not.toContain("PreToolUse");
  expect(hooks).not.toContain("pre-tool-use");
});
