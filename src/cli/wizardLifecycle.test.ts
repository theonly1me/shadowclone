import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import { loadSeedLibrary } from "../skills";
import { runWizard } from "./wizard";

async function runChoices(options: {
  readonly paths: ReturnType<typeof createProjectPaths>;
  readonly answers: readonly string[];
}): Promise<void> {
  const answers = [...options.answers];
  await runWizard({
    paths: options.paths,
    library: await loadSeedLibrary(),
    answer: () => answers.shift() ?? null,
    confirm: () => true,
    writeLine: () => {},
  });
}

function skillPath(options: {
  readonly home: string;
  readonly provider: ".agents" | ".claude";
  readonly name: string;
}): string {
  return path.join(
    options.home,
    options.provider,
    "skills",
    options.name,
    "SKILL.md",
  );
}

const firstChoices = ["1", "1", "1", "1", "1", "none"];
const secondChoices = ["1", "1", "1", "1", "2", "none"];

test("removes an unedited starter skill when its axis choice changes", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-wizard-life-"));
  const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
  await runChoices({ paths, answers: firstChoices });
  await runChoices({ paths, answers: secondChoices });

  expect(await Bun.file(skillPath({
    home,
    provider: ".agents",
    name: "testing-first",
  })).exists()).toBeFalse();
  expect(await Bun.file(skillPath({
    home,
    provider: ".agents",
    name: "testing-risk-based",
  })).exists()).toBeTrue();
});

test("repairs a missing copy of a selected portable skill", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-wizard-life-"));
  const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
  await runChoices({ paths, answers: firstChoices });
  const claudeSkill = skillPath({
    home,
    provider: ".claude",
    name: "testing-first",
  });
  await rm(path.dirname(claudeSkill), { recursive: true, force: true });

  await runChoices({ paths, answers: firstChoices });

  expect(await Bun.file(claudeSkill).exists()).toBeTrue();
});

test("preserves an edited starter skill when a sibling is selected", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-wizard-life-"));
  const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
  await runChoices({ paths, answers: firstChoices });
  const firstSkill = skillPath({
    home,
    provider: ".agents",
    name: "testing-first",
  });
  const editedBody = "Keep the reasoning in names and tests.";
  await Bun.write(
    firstSkill,
    `${await Bun.file(firstSkill).text()}\n${editedBody}\n`,
  );

  await runChoices({ paths, answers: secondChoices });

  expect(await Bun.file(firstSkill).text()).toContain(editedBody);
  expect(await Bun.file(skillPath({
    home,
    provider: ".agents",
    name: "testing-risk-based",
  })).exists()).toBeTrue();
});
