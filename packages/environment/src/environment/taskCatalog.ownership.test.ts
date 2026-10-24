import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { readLocalText } from "@shadowclone/core";
import { nativePublication } from "./native";
import { publishEnvironmentRevision } from "./revision";
import { environmentFile, readEnvironment, renderEnvironment } from "./store";
import { syncLearningEnvironment } from "./sync";
import { catalogFixture } from "./taskCatalog.fixtures";
import { undoRevision } from "./undo";

test("catalog publication preserves a manual edit", async () => {
  const setup = await catalogFixture();
  try {
    await syncLearningEnvironment(setup.paths);
    const edited = "Keep this manually authored catalog.\n";
    await Bun.write(setup.catalogPath, edited);
    await expect(syncLearningEnvironment(setup.paths)).rejects.toThrow("catalog changed");
    expect(await Bun.file(setup.catalogPath).text()).toBe(edited);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});

test("catalog creation and its ownership record undo together", async () => {
  const setup = await catalogFixture();
  try {
    const publication = await nativePublication({ paths: setup.paths, state: setup.state });
    const filePath = environmentFile(setup.paths);
    const revision = await publishEnvironmentRevision({
      paths: setup.paths,
      updates: [
        ...publication.updates,
        {
          filePath,
          previous: await readLocalText(filePath),
          next: renderEnvironment(publication.state),
        },
      ],
    });
    expect(await Bun.file(setup.catalogPath).exists()).toBe(true);
    if (!revision) throw new Error("Expected a catalog revision");
    await undoRevision({ paths: setup.paths, id: revision });
    expect(await Bun.file(setup.catalogPath).exists()).toBe(false);
    expect(await readEnvironment(setup.paths)).toEqual(setup.state);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
