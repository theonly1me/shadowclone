import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "@shadowclone/core";
import { detectedIntegrationAgents } from "./initDetection";

test("OpenCode detection ignores the configuration folder that shadowclone builds write", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-detection-"));
  const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
  const searchPath = process.env.PATH;

  process.env.PATH = "";

  try {
    await Bun.write(path.join(paths.opencodeConfigDirectory, "plugins/shadowclone.js"), "plugin");

    expect(await detectedIntegrationAgents(paths)).not.toContain("opencode");

    await Bun.write(paths.opencodeDatabaseFile, "database");

    expect(await detectedIntegrationAgents(paths)).toContain("opencode");
  } finally {
    process.env.PATH = searchPath;
    await rm(home, { recursive: true, force: true });
  }
});
