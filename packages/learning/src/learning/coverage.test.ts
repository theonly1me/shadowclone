import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths, defaultConfig } from "@shadowclone/core";
import { readCoveredGuidance } from "./coverage";
import { syntheticSecret } from "./testing";

test("learning reads the user's instruction files only with agent-context consent and redacts them", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-coverage-"));
  try {
    const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
    await Bun.write(path.join(home, ".codex/AGENTS.md"), `Never use the em dash.\nToken: ${syntheticSecret}\n`);

    expect(await readCoveredGuidance({ paths, config: defaultConfig })).toEqual([]);

    const covered = await readCoveredGuidance({
      paths, config: { ...defaultConfig, sources: { ...defaultConfig.sources, "agent-context": true } },
    });
    expect(covered.map(({ source }) => source)).toEqual(["~/.codex/AGENTS.md"]);
    expect(covered[0]?.text).toContain("Never use the em dash.");
    expect(covered[0]?.text).not.toContain(syntheticSecret);
  } finally { await rm(home, { recursive: true, force: true }); }
});
