import { expect, test } from "bun:test";
import path from "node:path";
import { loadSeedLibrary } from "./index";

const preferenceIds = [
  "dependencies-existing",
  "dependencies-mature",
  "planning-first",
  "planning-when-costly",
  "questions-autonomous",
  "questions-early",
  "refactor-boundaries",
  "refactor-preserve",
];

const skillIds = [
  "design-deep-modules",
  "diagnose-before-editing",
  "prove-regression-tests",
  "research-primary-sources",
  "resolve-conflicts-by-intent",
  "scope-confirmed-changes",
  "testing-first",
  "testing-risk-based",
  "typescript-type-safety",
  "verify-and-review",
];

function packageDirectories(): {
  readonly preferencesDirectory: string;
  readonly skillsDirectory: string;
} {
  const packageRoot = path.resolve(import.meta.dir, "../..");
  return {
    preferencesDirectory: path.join(packageRoot, "preferences"),
    skillsDirectory: path.join(packageRoot, "skills"),
  };
}

test("ships complete Agent Skills without the local comment rule", async () => {
  const directories = packageDirectories();
  const skillFiles: string[] = [];
  const glob = new Bun.Glob("*/SKILL.md");
  for await (const skillFile of glob.scan({
    cwd: directories.skillsDirectory,
  })) {
    skillFiles.push(skillFile);
  }

  expect(skillFiles.sort()).toHaveLength(10);
  expect(
    await Bun.file(
      path.join(directories.preferencesDirectory, "comments-none.md"),
    ).exists(),
  ).toBeFalse();
});

test("loads preferences and Agent Skills into honest groups", async () => {
  const library = await loadSeedLibrary(packageDirectories());

  expect(library.preferences.map((entry) => entry.id)).toEqual(preferenceIds);
  expect(library.skills.map((entry) => entry.id)).toEqual(skillIds);
  expect(library.guidance).toHaveLength(18);
  expect(
    library.axes.map((axis) => [axis.id, axis.guidance.length]),
  ).toEqual([
    ["dependency-posture", 2],
    ["planning-threshold", 2],
    ["question-frequency", 2],
    ["refactor-tolerance", 2],
    ["testing-approach", 2],
  ]);
  expect(library.independentSkills).toHaveLength(8);
  expect(
    library.guidance.some((entry) => entry.id.startsWith("comments-")),
  ).toBeFalse();
});

test("loads every Agent Skill with its routing and workflow contract", async () => {
  const library = await loadSeedLibrary(packageDirectories());

  for (const skill of library.skills) {
    expect(skill.description.length).toBeGreaterThan(40);
    expect(skill.body).toContain("## Use when");
    expect(skill.body).toContain("## Process");
    expect(skill.body).toContain("## Guardrails");
    expect(skill.body).toContain("## Completion");
  }
});
