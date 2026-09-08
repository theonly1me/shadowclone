import {
  loadSeedSkillLibrary,
  type SeedSkillLibrary,
} from "../skills";

export function renderSeedSkillLibrary(
  library: SeedSkillLibrary,
): readonly string[] {
  const lines = ["Skill axes"];
  for (const axis of library.axes) {
    lines.push(`  ${axis.id}`);
    for (const skill of axis.skills) {
      lines.push(`    ${skill.id}: ${skill.title}`);
    }
  }
  lines.push("", "Disciplines");
  for (const skill of library.disciplines) {
    lines.push(`  ${skill.id}: ${skill.title}`);
  }
  return lines;
}

export async function listSeedSkills(): Promise<void> {
  const library = await loadSeedSkillLibrary();
  for (const line of renderSeedSkillLibrary(library)) {
    console.log(line);
  }
}
