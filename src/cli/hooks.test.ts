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
  getPreToolUseDecision,
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

test("the boundary hook denies a tool from the active origin", async () => {
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
        title: "Has refused Bash tool requests",
        body: "Treat the `Bash` tool as requiring explicit approval.",
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

  const decision = await getPreToolUseDecision({
    input: JSON.stringify({ tool_name: "Bash", cwd: homeDirectory }),
    configPath: paths.configFile,
    paths,
    managedConfigPath: null,
  });
  const context = await getSessionStartContext({
    input: JSON.stringify({ cwd: homeDirectory }),
    configPath: paths.configFile,
    paths,
    managedConfigPath: null,
  });

  expect(decision?.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(decision?.hookSpecificOutput.permissionDecisionReason).not.toContain(
    homeDirectory,
  );
  expect(context?.hookSpecificOutput.additionalContext).toContain(
    "Has refused Bash tool requests",
  );
});
