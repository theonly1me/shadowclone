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
  await Bun.write(
    path.join(transcriptDirectory, "session.jsonl"),
    `${JSON.stringify({
      type: "user",
      sessionId: "session-1",
      uuid: "event-1",
      message: { id: "message-1", content: "plan this change" },
    })}\n`,
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
  expect(index.countEvents()).toBe(1);
  index.close();
});
