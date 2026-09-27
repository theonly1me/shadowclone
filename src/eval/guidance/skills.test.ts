import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { guidanceFixture } from "./fixtures";
import { contextFiles, installGuidanceContext } from "./context";
import { validateScenarios } from "./prepare";
import { suiteSchema } from "./schema";

test("skills protocol compares distinct libraries without a profile overlay or memory in the maintained arm", async () => {
  const fixture = guidanceFixture();

  const suite = suiteSchema.parse({
    ...fixture,
    protocol: "guidance-skills-v1",
    profile: "",
    bootstrap: "",
    references: [],
    maintainedContext: [
      {
        relativePath: "instructions/routing.md",
        content: "Before every task read the baseline skill.",
      },
      {
        relativePath: "skills/maintained/clean-code/SKILL.md",
        content:
          "---\nname: clean-code\ndescription: Before edits.\n---\nUse complete names and check preconditions.",
      },
    ],
  });

  validateScenarios(suite);

  expect(contextFiles({ suite, arm: "bare" })).toEqual([]);
  expect(contextFiles({ suite, arm: "skills" })).toEqual(fixture.context);
  expect(contextFiles({ suite, arm: "memory" })).toEqual([
    ...fixture.context,
    ...fixture.memory,
  ]);
  expect(contextFiles({ suite, arm: "clone" })).toEqual(
    suite.maintainedContext ?? [],
  );

  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-skills-eval-"),
  );
  const prompt = await installGuidanceContext({
    suite,
    arm: "clone",
    directory,
  });

  expect(prompt).toContain("Before every task read the baseline skill.");
  expect(prompt).not.toContain("Use complete names and check preconditions.");
  expect(prompt).not.toContain("profile");
  expect(
    await Bun.file(
      path.join(directory, ".eval-context/memory/MEMORY.md"),
    ).exists(),
  ).toBeFalse();
  expect(() =>
    validateScenarios({ ...suite, profile: "An old profile overlay" }),
  ).toThrow("without a profile overlay");
});
