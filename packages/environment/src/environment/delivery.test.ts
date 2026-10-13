import { expect, test } from "bun:test";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { configureSkillMaintenance } from "@shadowclone/skills";
import { fixtureSkill } from "@shadowclone/skills/testing";
import { materializeSkillDelivery } from "./delivery";
import { writeEnvironment } from "./store";
import { skillFixture } from "./testing";
import { emptyEnvironment } from "./types";

test("delivery keeps one copy of a skill name and prefers the repository copy", async () => {
  const setup = await skillFixture();
  const repositoryCopy = path.join(setup.cwd, ".claude/skills/typed-changes/SKILL.md");

  await Bun.write(repositoryCopy, fixtureSkill().replace("Preserve the requested behavior.", "Follow the repository workflow."));
  await configureSkillMaintenance({ ...setup, scope: "repository" });
  await writeEnvironment({
    paths: setup.paths,
    state: {
      ...emptyEnvironment,
      phase: "active",
      baselineDirectory: setup.home,
      repositories: [{ directory: setup.cwd, originDirectory: "synthetic-owner", repositoryName: "synthetic-repository" }],
      artifacts: [{
        filePath: setup.filePath,
        fingerprint: "synthetic",
        original: null,
        kind: "skill",
        scope: "global",
        name: "typed-changes",
        description: "Make typed changes.",
        learningKeys: [],
      }],
    },
  });

  const sources: string[] = [];

  await materializeSkillDelivery({
    paths: setup.paths,
    repositoryDirectory: setup.cwd,
    destination: await mkdtemp(path.join(setup.home, "delivery-")),
    onArtifact: async ({ source }) => {
      sources.push(source);
    },
  });

  expect(sources.filter((source) => source.endsWith("typed-changes/SKILL.md"))).toEqual([repositoryCopy]);
});
