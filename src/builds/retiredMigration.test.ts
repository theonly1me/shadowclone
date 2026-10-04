import { expect, test } from "bun:test";
import path from "node:path";
import { publishEnvironmentRevision } from "../environment/revision";
import { loadSeedLibrary, seedSkillsDirectory } from "../skills/library";
import { renderRetiredSkillChanges } from "./retired";
import { migrateRetiredSkills } from "./retiredMigration";
import { installedBuild, skillRoots } from "./syncFixtures";
import type { BuildInput } from "./types";

const retired = new Map([
  ["prove-regression-tests", { replacement: "design-deep-modules" }],
  [
    "testing-first",
    {
      replacement: "design-deep-modules",
      defaultPreference: "Write the failing test before the production change.",
    },
  ],
  ["testing-risk-based", { replacement: "design-deep-modules" }],
]);

async function packagedText(name: string): Promise<string> {
  return Bun.file(path.join(await seedSkillsDirectory(), name, "SKILL.md")).text();
}

async function migratedBuild(options: {
  readonly input: Partial<BuildInput>;
  readonly before?: (home: string) => Promise<void>;
}) {
  const setup = await installedBuild(options.input);

  await options.before?.(setup.home);

  const libraryIds = new Set(
    (await loadSeedLibrary()).guidance.map((entry) => entry.id).filter((id) => !retired.has(id)),
  );
  const result = await migrateRetiredSkills({
    paths: setup.paths,
    state: setup.state,
    retired,
    libraryIds,
  });

  await publishEnvironmentRevision({
    paths: setup.paths,
    updates: result.updates,
    state: result.state,
  });

  const installed = async (name: string) =>
    Promise.all(
      skillRoots.map((root) => Bun.file(path.join(setup.home, root, name, "SKILL.md")).exists()),
    );

  return { ...setup, result, installed };
}

test("retired skills are replaced in the build, and their copies go away", async () => {
  const setup = await migratedBuild({
    input: {
      choices: { "testing-first": true, "prove-regression-tests": true, "verify-and-review": true },
    },
  });

  expect(setup.result.state.builds.map((build) => build.choices)).toEqual([
    { "verify-and-review": true, "design-deep-modules": true },
  ]);
  expect(await setup.installed("testing-first")).toEqual([false, false, false]);
  expect(await setup.installed("prove-regression-tests")).toEqual([false, false, false]);

  for (const root of skillRoots) {
    expect(await Bun.file(path.join(setup.home, root, "design-deep-modules/SKILL.md")).text()).toBe(
      await packagedText("design-deep-modules"),
    );
  }

  expect(renderRetiredSkillChanges(setup.result.changes)).toEqual([
    "Replaced prove-regression-tests and testing-first with design-deep-modules in your global build.",
    'To keep the testing-first default, run: shadowclone remember --global "Write the failing test before the production change."',
  ]);
});

test("an edited retired copy stays selected, and the other retired skill is still replaced", async () => {
  let edited = "";
  const setup = await migratedBuild({
    input: { choices: { "testing-first": true, "prove-regression-tests": true } },
    before: async (home) => {
      edited = path.join(home, ".claude/skills/testing-first/SKILL.md");
      await Bun.write(edited, `${await Bun.file(edited).text()}\nMy own rule.\n`);
    },
  });

  expect(setup.result.state.builds.map((build) => build.choices)).toEqual([
    { "testing-first": true, "design-deep-modules": true },
  ]);
  expect(await setup.installed("testing-first")).toEqual([true, true, true]);
  expect(await setup.installed("prove-regression-tests")).toEqual([false, false, false]);
  expect(renderRetiredSkillChanges(setup.result.changes)).toEqual([
    `Kept your edited copy of testing-first at ${edited}. It is no longer bundled. To replace it with design-deep-modules, use shadowclone wizard.`,
    "Replaced prove-regression-tests with design-deep-modules in your global build.",
  ]);
});

test("a retired skill changed in the build editor stays selected and is named", async () => {
  const setup = await migratedBuild({
    input: {
      choices: { "testing-first": true },
      edits: { "testing-first": `${await packagedText("testing-first")}\nBuild editor rule.\n` },
    },
  });

  expect(setup.result.updates).toEqual([]);
  expect(setup.result.state.builds.map((build) => build.choices)).toEqual([
    { "testing-first": true },
  ]);
  expect(renderRetiredSkillChanges(setup.result.changes)).toEqual([
    "Kept testing-first in your global build, because you changed it in the build editor. It is no longer bundled. To replace it with design-deep-modules, use shadowclone wizard.",
  ]);
});

test("a deselected retired skill leaves the build without adding its replacement", async () => {
  const setup = await migratedBuild({
    input: { choices: { "testing-first": false, "verify-and-review": true } },
  });

  expect(setup.result.state.builds.map((build) => build.choices)).toEqual([
    { "verify-and-review": true },
  ]);
  expect(await setup.installed("design-deep-modules")).toEqual([false, false, false]);
  expect(setup.result.changes).toEqual([]);
});

test("a replacement that cannot be installed is reported and leaves the build unchanged", async () => {
  const setup = await migratedBuild({
    input: { choices: { "testing-first": true } },
    before: async (home) => {
      await Bun.write(
        path.join(home, ".claude/skills/design-deep-modules/SKILL.md"),
        "---\nname: design-deep-modules\ndescription: The user's own skill.\n---\n\nMine.\n",
      );
    },
  });

  expect(setup.result.state.builds.map((build) => build.choices)).toEqual([
    { "testing-first": true },
  ]);
  expect(await setup.installed("testing-first")).toEqual([true, true, true]);
  expect(renderRetiredSkillChanges(setup.result.changes)).toEqual([
    "Could not replace testing-first with design-deep-modules in your global build: An existing skill occupies this destination; select that skill to edit it",
  ]);
});

test("nothing migrates while the retired skills are still bundled", async () => {
  const setup = await installedBuild({ choices: { "testing-first": true } });
  const result = await migrateRetiredSkills({ paths: setup.paths, state: setup.state });

  expect(result.updates).toEqual([]);
  expect(result.changes).toEqual([]);
});
