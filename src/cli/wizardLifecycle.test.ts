import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths } from "../paths";
import {
  parseProfileBlocks,
  readProfileRejections,
} from "../profile";
import {
  loadSeedLibrary,
  seedGuidanceProfileKey,
} from "../skills";
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

const firstChoices = ["1", "1", "1", "1", "1", "none"];

test("retires an unedited sibling when an axis choice changes", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-wizard-life-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await runChoices({ paths, answers: firstChoices });
  await runChoices({
    paths,
    answers: ["1", "1", "1", "1", "2", "none"],
  });

  const engineering = await Bun.file(
    path.join(paths.profileDirectory, "global/engineering.md"),
  ).text();
  expect(engineering).not.toContain("## Test First Through a Public Seam");
  expect(engineering).toContain("## Test Where Behavior Is at Risk");
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
    (block) => block.key !== seedGuidanceProfileKey("testing-first"),
  );
  await Bun.write(
    engineeringPath,
    `${kept.map((block) => block.content).join("\n\n")}\n`,
  );

  await runChoices({ paths, answers: firstChoices });

  const rejections = await readProfileRejections(paths.rejectedProfileFile);
  expect(rejections.map((entry) => entry.key)).toContain(
    seedGuidanceProfileKey("testing-first"),
  );
  expect(await Bun.file(engineeringPath).text()).not.toContain(
    "## Test First Through a Public Seam",
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
    "Use this skill when a behavior can be exercised through an interface that callers already use, or through the interface the change is intended to create.",
    editedBody,
  );
  await Bun.write(engineeringPath, edited);

  await runChoices({
    paths,
    answers: ["1", "1", "1", "1", "2", "none"],
  });

  const current = await Bun.file(engineeringPath).text();
  expect(current).toContain(editedBody);
  expect(current).toContain("## Test Where Behavior Is at Risk");
});
