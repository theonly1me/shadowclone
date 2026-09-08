import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import {
  parseProfileBlocks,
  readProfileRejections,
} from "../profile";
import { loadSeedSkillLibrary, seedSkillProfileKey } from "../skills";
import { runWizard } from "./wizard";

async function runChoices(options: {
  readonly paths: ReturnType<typeof createProjectPaths>;
  readonly answers: readonly string[];
}): Promise<void> {
  const answers = [...options.answers];
  await runWizard({
    paths: options.paths,
    library: await loadSeedSkillLibrary(),
    answer: () => answers.shift() ?? null,
    confirm: () => true,
    writeLine: () => {},
  });
}

const firstChoices = ["1", "1", "1", "1", "1", "1", "none"];

test("retires an unedited sibling when an axis choice changes", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-life-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await runChoices({ paths, answers: firstChoices });
  await runChoices({
    paths,
    answers: ["2", "1", "1", "1", "1", "1", "none"],
  });

  const engineering = await Bun.file(
    path.join(paths.profileDirectory, "global/engineering.md"),
  ).text();
  expect(engineering).not.toContain("## Write no comments");
  expect(engineering).toContain("## Document public interfaces");
});

test("keeps a deleted selected skill rejected", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-life-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await runChoices({ paths, answers: firstChoices });
  const engineeringPath = path.join(
    paths.profileDirectory,
    "global/engineering.md",
  );
  const blocks = parseProfileBlocks(await Bun.file(engineeringPath).text());
  const kept = blocks.filter(
    (block) => block.key !== seedSkillProfileKey("comments-none"),
  );
  await Bun.write(
    engineeringPath,
    `${kept.map((block) => block.content).join("\n\n")}\n`,
  );

  await runChoices({ paths, answers: firstChoices });

  const rejections = await readProfileRejections(paths.rejectedProfileFile);
  expect(rejections.map((entry) => entry.key)).toContain(
    seedSkillProfileKey("comments-none"),
  );
  expect(await Bun.file(engineeringPath).text()).not.toContain(
    "## Write no comments",
  );
});

test("preserves an edited seed block when a sibling is selected", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-life-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await runChoices({ paths, answers: firstChoices });
  const engineeringPath = path.join(
    paths.profileDirectory,
    "global/engineering.md",
  );
  const editedBody = "Keep the reasoning in names and tests.";
  const edited = (await Bun.file(engineeringPath).text()).replace(
    "Write code whose names, types, and structure carry the explanation. Do not add comments. Put durable reasoning in tests, design records, and review text.",
    editedBody,
  );
  await Bun.write(engineeringPath, edited);

  await runChoices({
    paths,
    answers: ["2", "1", "1", "1", "1", "1", "none"],
  });

  const current = await Bun.file(engineeringPath).text();
  expect(current).toContain(editedBody);
  expect(current).toContain("## Document public interfaces");
});
