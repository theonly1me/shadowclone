import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import { parseProfileRules } from "../profile";
import {
  loadSeedLibrary,
  seedGuidanceProfileKey,
} from "../skills";
import {
  parseAxisChoice,
  parseOptionalSkillChoices,
  runWizard,
} from "./wizard";

const firstChoices = ["1", "1", "1", "1", "1", "none"];

test("accepts only displayed axis and optional skill choices", async () => {
  const library = await loadSeedLibrary();
  const [axis] = library.axes;
  if (!axis) {
    throw new Error("The seed library needs an axis");
  }

  for (const response of ["0", "1e0", "comments-none", "Write no"]) {
    expect(
      parseAxisChoice({ response, guidance: axis.guidance }),
    ).toBeNull();
  }
  expect(
    parseAxisChoice({ response: "1", guidance: axis.guidance })?.id,
  ).toBe(
    axis.guidance[0]?.id,
  );

  for (const response of ["0", "1,1", "all,1", "unknown", "Verify"]) {
    expect(
      parseOptionalSkillChoices({
        response,
        skills: library.independentSkills,
      }),
    ).toBeNull();
  }
  expect(
    parseOptionalSkillChoices({
      response: "1, 3",
      skills: library.independentSkills,
    })?.map((skill) => skill.id),
  ).toEqual(
    library.independentSkills
      .filter(
        (_, skillIndex) => skillIndex === 0 || skillIndex === 2,
      )
      .map((skill) => skill.id),
  );
});

test("prints every selection and writes nothing when confirmation is declined", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const library = await loadSeedLibrary();
  const answers = [...firstChoices];
  const output: string[] = [];

  const result = await runWizard({
    paths,
    library,
    answer: () => answers.shift() ?? null,
    confirm: () => false,
    writeLine: (line) => output.push(line),
  });

  expect(result.written).toBeFalse();
  expect(result.selectedGuidanceIds).toHaveLength(5);
  for (const guidanceId of result.selectedGuidanceIds) {
    const entry = library.guidance.find(
      (candidate) => candidate.id === guidanceId,
    );
    expect(entry ? output.includes(`  ${entry.title}`) : false).toBeTrue();
  }
  expect(await Bun.file(paths.profileDirectory).exists()).toBeFalse();
});

test("writes stable declared rules on identical reruns", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const library = await loadSeedLibrary();

  for (let runNumber = 0; runNumber < 2; runNumber += 1) {
    const answers = [...firstChoices];
    await runWizard({
      paths,
      library,
      answer: () => answers.shift() ?? null,
      confirm: () => true,
      writeLine: () => {},
    });
  }

  const engineeringPath = path.join(
    paths.profileDirectory,
    "global/engineering.md",
  );
  const workflowPath = path.join(paths.profileDirectory, "global/workflow.md");
  const engineeringText = await Bun.file(engineeringPath).text();
  const rules = [
    ...parseProfileRules(engineeringText),
    ...parseProfileRules(await Bun.file(workflowPath).text()),
  ];
  const testingFirst = rules.find(
    (rule) => rule.key === seedGuidanceProfileKey("testing-first"),
  );
  expect(rules).toHaveLength(5);
  expect(rules.every((rule) => rule.source === "declared")).toBeTrue();
  expect(rules.every((rule) => rule.key.startsWith("seed:"))).toBeTrue();
  expect(testingFirst?.title).toBe("Test First Through a Public Seam");
  expect(testingFirst?.body).toContain("### Process");
  expect(engineeringText).not.toContain("\n## Process");
});
