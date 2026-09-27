import { expect, test } from "bun:test";
import { skillFixture } from "../skillMaintenance/fixtures";
import { discoverDeliverySkills } from "../skillMaintenance/discover";
import { readMaintenanceState } from "../skillMaintenance/state";
import { readLocalText } from "../localFiles";
import { emptyEnvironment } from "./types";
import { environmentFile, renderEnvironment, writeEnvironment } from "./store";
import { freezeOriginalEnvironment } from "./freeze";
import { captureSkillComparison } from "./comparison";
import { skillPublication } from "./publication";
import { publishEnvironmentRevision } from "./revision";

test("evaluation keeps the original skill body after maintenance and rewrites live routes into the maintained snapshot", async () => {
  const setup = await skillFixture();
  const baselineDirectory = await freezeOriginalEnvironment(setup.paths);
  const state = {
    ...emptyEnvironment,
    phase: "active" as const,
    baselineDirectory,
  };

  await writeEnvironment({ paths: setup.paths, state });

  const { skills } = await discoverDeliverySkills(
    (await readMaintenanceState(setup.paths)).roots,
  );
  const [skill] = skills;

  if (!skill) {
    throw new Error("Expected a fixture skill");
  }

  const added = "Reject duplicate colors before writing the sample palette.";

  const published = await skillPublication({
    paths: setup.paths,
    state,
    scope: { key: "global", directory: setup.home, repository: null },
    skill,
    name: skill.name,
    text: `${skill.raw}\n${added}\n`,
    records: [],
  });

  const filePath = environmentFile(setup.paths);

  await publishEnvironmentRevision({
    paths: setup.paths,
    updates: [
      ...published.updates,
      {
        filePath,
        previous: await readLocalText(filePath),
        next: renderEnvironment(published.state),
      },
    ],
  });

  const comparison = await captureSkillComparison({
    paths: setup.paths,
    repository: setup.cwd,
  });
  const original = comparison.original.find((file) =>
    file.relativePath.endsWith("/typed-changes/SKILL.md"),
  );
  const maintained = comparison.maintained.find((file) =>
    file.relativePath.endsWith("/typed-changes/SKILL.md"),
  );

  expect(original?.content).toBe(setup.original);
  expect(original?.content).not.toContain(added);
  expect(maintained?.content).toContain(added);
  expect(
    comparison.maintained.find(
      (file) => file.relativePath === "instructions/routing.md",
    )?.content,
  ).toContain(".eval-context/skills/");
});
