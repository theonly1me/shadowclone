import { previewBuild, applyBuild } from "@shadowclone/builds";
import { initializeSkillEnvironment } from "@shadowclone/environment";
import type { SeedGuidance, SeedLibrary } from "@shadowclone/skills";
import type { ProjectPaths } from "@shadowclone/core";

export async function applyWizardSelection(options: {
  readonly paths: ProjectPaths;
  readonly library: SeedLibrary;
  readonly selected: readonly SeedGuidance[];
}): Promise<void> {
  await initializeSkillEnvironment({ paths: options.paths, automatic: false });

  const selected = new Set(options.selected.map((entry) => entry.id));
  const input = {
    scope: "global",
    choices: Object.fromEntries(
      options.library.guidance.map((entry) => [entry.id, selected.has(entry.id)]),
    ),
    edits: {},
    custom: [],
  };
  const context = { paths: options.paths, cwd: process.cwd() };

  await applyBuild({
    ...context,
    plan: await previewBuild({ ...context, input }),
  });
}
