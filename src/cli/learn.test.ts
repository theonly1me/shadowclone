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
import { learn } from "./learn";

test("learn indexes an enabled fixture corpus end to end", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-learn-"),
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
  const records = [
    {
      type: "user",
      sessionId: "session-1",
      uuid: "event-1",
      timestamp: "2026-09-05T08:00:00.000Z",
      cwd: "/repo",
      message: { id: "message-1", content: "plan this change" },
    },
    {
      type: "assistant",
      sessionId: "session-1",
      uuid: "event-2",
      timestamp: "2026-09-05T08:01:00.000Z",
      cwd: "/repo",
      message: {
        id: "message-2",
        content: [{ type: "tool_use", id: "tool-1", name: "Edit" }],
      },
    },
    {
      type: "user",
      sessionId: "session-1",
      uuid: "event-3",
      timestamp: "2026-09-05T08:02:00.000Z",
      cwd: "/repo",
      message: {
        id: "message-3",
        content: "[Request interrupted by user]",
      },
    },
  ];
  await Bun.write(
    path.join(transcriptDirectory, "session.jsonl"),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  const config = setSourceEnabled({
    config: defaultConfig,
    source: "claude-code",
    enabled: true,
  });
  await writeConfig({ config, configPath: paths.configFile });

  await learn({
    configPath: paths.configFile,
    databasePath: paths.indexDatabase,
    paths,
  });

  const index = await openEventIndex(paths.indexDatabase);
  expect(index.countEvents()).toBe(3);
  index.close();

  const profileGlob = new Bun.Glob("**/*.md");
  const profileFiles = [];
  for await (const filePath of profileGlob.scan({
    cwd: paths.profileDirectory,
    absolute: true,
    onlyFiles: true,
  })) {
    profileFiles.push(filePath);
  }
  if (profileFiles.length === 0) {
    throw new Error("Expected learn to write a profile");
  }
  const profile = (
    await Promise.all(
      profileFiles.map((filePath) => Bun.file(filePath).text()),
    )
  ).join("\n");
  expect(profile).toContain("Stops the agent while using Edit");
  expect(profile).not.toContain("plan this change");
});
