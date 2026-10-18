import { expect, test } from "bun:test";
import path from "node:path";
import { rm } from "node:fs/promises";
import { type EnvironmentArtifact, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { exportGuidance } from "./export";
import { guidanceFixture } from "./fixtures";
import { setupSelection } from "./setup/selection";

type Fixture = Awaited<ReturnType<typeof guidanceFixture>>;

async function addArtifacts(options: {
  readonly fixture: Fixture;
  readonly artifacts: readonly EnvironmentArtifact[];
  readonly globalBuild?: boolean;
}): Promise<void> {
  const state = await readEnvironment(options.fixture.paths);

  if (!state) {
    throw new Error("Expected the synthetic environment");
  }

  await writeEnvironment({
    paths: options.fixture.paths,
    state: {
      ...state,
      artifacts: [...state.artifacts, ...options.artifacts],
      builds: options.globalBuild
        ? [{ scope: "global", choices: {}, edits: {}, custom: [], directory: options.fixture.root, id: "global" }]
        : state.builds,
    },
  });
}

function skillArtifact(options: { readonly filePath: string; readonly name: string; readonly buildId?: string }): EnvironmentArtifact {
  return {
    filePath: options.filePath,
    fingerprint: "synthetic",
    original: null,
    kind: "skill",
    scope: "global",
    name: options.name,
    description: "Synthetic skill.",
    learningKeys: [],
    ...(options.buildId === undefined ? {} : { buildId: options.buildId }),
  };
}

test("cloud setup leaves out a build skill that has no copy left and still exports the others", async () => {
  const fixture = await guidanceFixture();

  try {
    await addArtifacts({
      fixture,
      globalBuild: true,
      artifacts: [
        skillArtifact({
          filePath: path.join(fixture.root, "home", ".agents", "skills", "deleted-review", "SKILL.md"),
          name: "deleted-review",
          buildId: "global",
        }),
      ],
    });

    const selection = await setupSelection(fixture);
    const delivery = await exportGuidance({ ...fixture, skills: selection.skills });

    expect(selection).toMatchObject({ skills: ["shadowclone-work"], leftOut: ["deleted-review"] });
    expect(delivery.skills).toEqual(["shadowclone-work"]);
  } finally {
    await fixture.cleanup();
  }
});

test("cloud export uses a copy that still exists when the preferred copy is missing", async () => {
  const fixture = await guidanceFixture();
  const claudeCopy = path.join(fixture.root, "home", ".claude", "skills", "shadowclone-work", "SKILL.md");

  try {
    await Bun.write(claudeCopy, await Bun.file(fixture.filePath).text());
    await addArtifacts({ fixture, artifacts: [skillArtifact({ filePath: claudeCopy, name: "shadowclone-work" })] });
    await rm(fixture.directory, { recursive: true, force: true });

    const delivery = await exportGuidance({ ...fixture, skills: (await setupSelection(fixture)).skills });

    expect(delivery.files.map((file) => file.path)).toContain(
      "plugins/shadowclone-personal/skills/shadowclone-work/SKILL.md",
    );
  } finally {
    await fixture.cleanup();
  }
});
