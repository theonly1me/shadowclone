import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import { parseProfileRules } from "../profile";
import { loadSeedSkillLibrary } from "../skills";
import {
  parseAxisChoice,
  parseDisciplineChoices,
  runWizard,
} from "./wizard";

const firstChoices = ["1", "1", "1", "1", "1", "1", "none"];

test("accepts only displayed axis and discipline choices", async () => {
  const library = await loadSeedSkillLibrary();
  const [axis] = library.axes;
  if (!axis) {
    throw new Error("The seed library needs an axis");
  }

  for (const response of ["0", "1e0", "comments-none", "Write no"]) {
    expect(parseAxisChoice({ response, skills: axis.skills })).toBeNull();
  }
  expect(parseAxisChoice({ response: "1", skills: axis.skills })?.id).toBe(
    axis.skills[0]?.id,
  );

  for (const response of ["0", "1,1", "all,1", "unknown", "Verify"]) {
    expect(
      parseDisciplineChoices({ response, skills: library.disciplines }),
    ).toBeNull();
  }
  expect(
    parseDisciplineChoices({ response: "1, 3", skills: library.disciplines })
      ?.map((skill) => skill.id),
  ).toEqual(
    library.disciplines
      .filter(
        (_, disciplineIndex) =>
          disciplineIndex === 0 || disciplineIndex === 2,
      )
      .map((skill) => skill.id),
  );
});

test("prints every selection and writes nothing when confirmation is declined", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const library = await loadSeedSkillLibrary();
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
  expect(result.selectedSkillIds).toHaveLength(6);
  for (const skillId of result.selectedSkillIds) {
    const skill = library.skills.find((candidate) => candidate.id === skillId);
    expect(skill ? output.includes(`  ${skill.title}`) : false).toBeTrue();
  }
  expect(await Bun.file(paths.profileDirectory).exists()).toBeFalse();
});

test("writes stable declared rules on identical reruns", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const library = await loadSeedSkillLibrary();

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
  const rules = [
    ...parseProfileRules(await Bun.file(engineeringPath).text()),
    ...parseProfileRules(await Bun.file(workflowPath).text()),
  ];
  expect(rules).toHaveLength(6);
  expect(rules.every((rule) => rule.source === "declared")).toBeTrue();
  expect(rules.every((rule) => rule.key.startsWith("seed:"))).toBeTrue();
});
