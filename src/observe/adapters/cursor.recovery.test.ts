import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig } from "../../config";
import { createProjectPaths } from "../../paths";
import { observeAll } from "../index";
import type { ObservationBatch } from "../types";

test("survives an unreadable cursor database without breaking the generator", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-cursor-invalid-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const sessionDirectory = path.join(
    paths.cursorChatsDirectory,
    "workspace",
    "cursor-session",
  );

  await mkdir(sessionDirectory, { recursive: true });

  const sourcePath = path.join(sessionDirectory, "store.db");

  await Bun.write(sourcePath, "not a sqlite database");

  const shellHistory = paths.shellHistoryFiles[0];

  if (!shellHistory) {
    throw new Error("No shell history files configured");
  }

  await mkdir(path.dirname(shellHistory), { recursive: true });
  await Bun.write(shellHistory, "echo hello\n");

  const config = {
    ...defaultConfig,
    sources: { ...defaultConfig.sources, cursor: true, shell: true },
  };

  const batches: ObservationBatch[] = [];

  for await (const batch of observeAll({
    config,
    paths,
    getCursor: () => null,
  })) {
    batches.push(batch);
  }

  expect(batches.length).toBe(1);
  expect(batches[0]?.source).toBe("shell");
});
