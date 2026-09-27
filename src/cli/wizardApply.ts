import { previewBuild, applyBuild } from "../builds";
import { readEnvironment } from "../environment/store";
import { initializeSkillEnvironment } from "../environment/initialize";
import {
  installSeedSkills,
  writeSeedGuidanceSelection,
  type SeedGuidance,
  type SeedLibrary,
} from "../skills";
import type { ProjectPaths } from "../paths";
import { refreshIntegrations } from "../integrations";

export async function applyWizardSelection(options: {
  readonly paths: ProjectPaths;
  readonly library: SeedLibrary;
  readonly selected: readonly SeedGuidance[];
}): Promise<void> {
  await initializeSkillEnvironment({ paths: options.paths, automatic: false });

  if ((await readEnvironment(options.paths))?.phase === "active") {
    const selected = new Set(options.selected.map((entry) => entry.id));
    const input = {
      scope: "global",
      choices: Object.fromEntries(
        options.library.guidance.map((entry) => [
          entry.id,
          selected.has(entry.id),
        ]),
      ),
      edits: {},
      custom: [],
    };
    const context = { paths: options.paths, cwd: process.cwd() };

    await applyBuild({
      ...context,
      plan: await previewBuild({ ...context, input }),
    });

    return;
  }

  await installSeedSkills({
    paths: options.paths,
    skills: options.selected.filter((entry) => entry.kind === "skill"),
    availableSkills: options.library.skills,
  });
  await writeSeedGuidanceSelection({
    paths: options.paths,
    library: options.library,
    selectedGuidance: options.selected.filter(
      (entry) => entry.kind === "preference",
    ),
  });
  await refreshIntegrations({
    paths: options.paths,
    configPath: options.paths.configFile,
  });
}
