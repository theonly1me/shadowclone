import { expect, test } from "bun:test";
import { symlink } from "node:fs/promises";
import path from "node:path";
import { defaultConfig, writeConfig } from "@shadowclone/core";
import { emptyEnvironment, writeEnvironment } from "@shadowclone/environment";
import { skillFixture } from "@shadowclone/environment/testing";
import { inspectSkillLibrary } from "./lifecycle";
import { fixtureSkill } from "@shadowclone/skills/testing";

test("disabled consent prevents library reads", async () => {
  const setup = await skillFixture();

  await writeConfig({
    configPath: setup.paths.configFile,
    config: defaultConfig,
  });

  await expect(inspectSkillLibrary(setup)).rejects.toThrow("disabled");
});

test("malformed skills and unavailable references are reported without mutation", async () => {
  const setup = await skillFixture();

  await Bun.write(
    setup.filePath,
    `${setup.original}\nRead [guidance](references/missing.md).\n`,
  );
  await Bun.write(
    path.join(setup.home, ".agents/skills/broken/SKILL.md"),
    "Missing metadata",
  );

  expect(await inspectSkillLibrary(setup)).toMatchObject({
    invalid: 2,
    skills: [],
  });
  expect(await Bun.file(setup.filePath).text()).toContain(
    "references/missing.md",
  );
});

test("a skill that names another skill's file in backticks stays valid", async () => {
  const setup = await skillFixture();

  await Bun.write(
    setup.filePath,
    `${setup.original}\nThe review skill keeps its tone in \`references/voice.md\`.\n`,
  );

  expect(await inspectSkillLibrary(setup)).toMatchObject({ invalid: 0 });
});

test("symlinked content is ignored and identical portable copies collapse", async () => {
  const setup = await skillFixture();

  await symlink(
    setup.directory,
    path.join(setup.home, ".claude/skills/linked"),
  );
  await Bun.write(
    path.join(setup.home, ".agents/skills/typed-changes/SKILL.md"),
    fixtureSkill(),
  );

  const discovered = await inspectSkillLibrary(setup);

  expect(discovered.skills).toHaveLength(1);
  expect(discovered.duplicates).toBe(0);
});

test("the library lists skills while native routing is over its size limit", async () => {
  const setup = await skillFixture();

  await writeEnvironment({
    paths: setup.paths,
    state: { ...emptyEnvironment, phase: "active", facts: [{ scope: "global", text: "x".repeat(4096), learningKeys: ["fact"] }] },
  });

  expect((await inspectSkillLibrary(setup)).skills.map(({ name }) => name)).toEqual(["typed-changes"]);
});
