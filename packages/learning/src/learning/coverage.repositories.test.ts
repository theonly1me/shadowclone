import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "@shadowclone/core";
import { emptyEnvironment, writeEnvironment } from "@shadowclone/environment";
import { skillFixture } from "@shadowclone/environment/testing";
import { normalizeRemoteRepository } from "@shadowclone/sessions";
import { readCoveredGuidance } from "./coverage";
import { syntheticSecret } from "./testing";

const remote = "https://github.com/synthetic-org/palettes.git";
const instruction = "Generate palettes with the repository export command.";
const skillInstruction = "Reject duplicate palette entries before export.";

async function repositoryFixture() {
  const setup = await skillFixture({ scope: "repository" });
  expect(Bun.spawnSync(["git", "init", "--quiet", setup.cwd]).exitCode).toBe(0);
  expect(
    Bun.spawnSync(["git", "-C", setup.cwd, "config", "remote.origin.url", remote]).exitCode,
  ).toBe(0);
  const identity = normalizeRemoteRepository(remote);
  if (!identity?.profileFileName) throw new Error("Expected a synthetic repository");
  await writeEnvironment({
    paths: setup.paths,
    state: {
      ...emptyEnvironment,
      phase: "active",
      repositories: [
        {
          directory: setup.cwd,
          originDirectory: identity.origin.directoryName,
          repositoryName: identity.profileFileName,
        },
      ],
    },
  });
  await Bun.write(path.join(setup.cwd, "AGENTS.md"), `${instruction} Token: ${syntheticSecret}\n`);
  await Bun.write(
    setup.filePath,
    setup.original.replace("Preserve the requested behavior.", skillInstruction),
  );
  const config = await readConfig({ configPath: setup.paths.configFile });
  return {
    ...setup,
    config: {
      ...config,
      sources: { ...config.sources, "agent-context": true, "git-metadata": true },
    },
  };
}

test("verified repository instructions and skill bodies provide redacted scoped coverage", async () => {
  const setup = await repositoryFixture();
  try {
    const coverage = await readCoveredGuidance(setup);
    expect(coverage.map(({ text }) => text).join("\n")).toContain(instruction);
    expect(coverage.map(({ text }) => text).join("\n")).toContain(skillInstruction);
    expect(coverage.map(({ text }) => text).join("\n")).not.toContain(syntheticSecret);
    expect(coverage.filter(({ repository }) => repository !== undefined)).toHaveLength(2);
    const disabled = await readCoveredGuidance({
      paths: setup.paths,
      config: { ...setup.config, sources: { ...setup.config.sources, "git-metadata": false } },
    });
    expect(disabled.map(({ text }) => text).join("\n")).not.toContain(instruction);
    expect(disabled.map(({ text }) => text).join("\n")).not.toContain(skillInstruction);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("a changed repository origin cannot contribute instruction or skill coverage", async () => {
  const setup = await repositoryFixture();
  try {
    expect(
      Bun.spawnSync([
        "git",
        "-C",
        setup.cwd,
        "config",
        "remote.origin.url",
        "https://github.com/another-org/billing.git",
      ]).exitCode,
    ).toBe(0);
    expect(await readCoveredGuidance(setup)).toEqual([]);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
