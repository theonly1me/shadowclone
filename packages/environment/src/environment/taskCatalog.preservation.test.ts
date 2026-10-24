import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { readLocalText } from "@shadowclone/core";
import { nativePublication, type SkippedRouting } from "./native";
import { publishEnvironmentRevision } from "./revision";
import { environmentFile, readEnvironment, renderEnvironment, writeEnvironment } from "./store";
import { syncLearningEnvironment } from "./sync";
import { repositoryCatalogFixture } from "./taskCatalog.repository.fixtures";
import { undoRevision } from "./undo";

test.each(["edited", "untracked"] as const)(
  "an %s repository catalog stays unchanged while other scopes publish",
  async (reason) => {
    const setup = await repositoryCatalogFixture();
    try {
      expect(Bun.spawnSync(["git", "init", setup.cwd]).exitCode).toBe(0);
      expect(
        Bun.spawnSync([
          "git",
          "-C",
          setup.cwd,
          "config",
          "remote.origin.url",
          "https://github.com/synthetic/catalogs.git",
        ]).exitCode,
      ).toBe(0);
      await syncLearningEnvironment(setup.paths);
      const state = await readEnvironment(setup.paths);
      if (!state) throw new Error("Expected a published environment");
      if (reason === "untracked")
        await writeEnvironment({
          paths: setup.paths,
          state: {
            ...state,
            artifacts: state.artifacts.filter(
              (artifact) => artifact.filePath !== setup.repositoryCatalog,
            ),
          },
        });
      const edited = "Keep this manually maintained catalog.\n";
      await Bun.write(setup.repositoryCatalog, edited);
      await Bun.write(
        setup.filePath,
        (await Bun.file(setup.filePath).text()).replace(
          "Use when editing typed code.",
          "Use when checking public exports.",
        ),
      );
      const skipped: SkippedRouting[] = [];
      await syncLearningEnvironment(setup.paths, {
        onSkipped: (entries) => skipped.push(...entries),
      });
      expect(skipped).toEqual([{ kind: "catalog", path: setup.repositoryCatalog, reason }]);
      expect(await Bun.file(setup.repositoryCatalog).text()).toBe(edited);
      expect(await Bun.file(setup.catalogPath).text()).toContain(
        "Use when checking public exports.",
      );
      const preserved = await readEnvironment(setup.paths);
      if (!preserved) throw new Error("Expected a preserved environment");
      expect(
        preserved.artifacts.some((artifact) => artifact.filePath === setup.repositoryCatalog),
      ).toBe(reason === "edited");

      const publication = await nativePublication({
        paths: setup.paths,
        state: preserved,
        replaceEdited: true,
      });
      expect(publication.skipped).toEqual([]);
      expect(publication.replaced).toContainEqual({ agent: null, path: setup.repositoryCatalog });
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
      expect(await Bun.file(setup.repositoryCatalog).text()).toContain(
        "Read: `.agents/skills/repository-types/SKILL.md`.",
      );
      if (!revision) throw new Error("Expected a replacement revision");
      await undoRevision({ paths: setup.paths, id: revision });
      expect(await Bun.file(setup.repositoryCatalog).text()).toBe(edited);
      expect(await readEnvironment(setup.paths)).toEqual(preserved);
    } finally {
      await rm(setup.home, { recursive: true, force: true });
    }
  },
);
