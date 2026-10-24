import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { readConfig } from "@shadowclone/core";
import { skillFixture } from "@shadowclone/environment/testing";
import { readCoveredGuidance } from "./coverage";
import { syntheticSecret } from "./testing";

const instruction = "Reject duplicate palette entries before an export.";

test("duplicate coverage includes a rule found only in a personal skill body and redacts secrets", async () => {
  const setup = await skillFixture();
  try {
    await Bun.write(
      setup.filePath,
      setup.original.replace(
        "Preserve the requested behavior.",
        `${instruction} Token: ${syntheticSecret}`,
      ),
    );
    const config = await readConfig({ configPath: setup.paths.configFile });
    const coverage = await readCoveredGuidance({ paths: setup.paths, config });
    expect(coverage.map(({ text }) => text).join("\n")).toContain(instruction);
    expect(coverage.map(({ text }) => text).join("\n")).not.toContain(syntheticSecret);
    const disabled = await readCoveredGuidance({
      paths: setup.paths,
      config: { ...config, sources: { ...config.sources, "skill-library": false } },
    });
    expect(disabled.map(({ text }) => text).join("\n")).not.toContain(instruction);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("third-party skill bodies do not become user-owned duplicate coverage", async () => {
  const setup = await skillFixture({ thirdParty: true });
  try {
    await Bun.write(
      setup.filePath,
      setup.original.replace("Preserve the requested behavior.", instruction),
    );
    const config = await readConfig({ configPath: setup.paths.configFile });
    const coverage = await readCoveredGuidance({ paths: setup.paths, config });
    expect(coverage.map(({ text }) => text).join("\n")).not.toContain(instruction);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
