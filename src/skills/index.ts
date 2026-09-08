import { readdir } from "node:fs/promises";
import path from "node:path";
import { parseSeedSkillDocument } from "./parse";
import type {
  SeedSkill,
  SeedSkillAxis,
  SeedSkillLibrary,
} from "./schema";

export type {
  SeedSkill,
  SeedSkillAxis,
  SeedSkillLibrary,
} from "./schema";

async function containsSkillFiles(directory: string): Promise<boolean> {
  try {
    const filenames = await readdir(directory);
    return filenames.some((filename) => filename.endsWith(".md"));
  } catch {
    return false;
  }
}

async function resolveSeedSkillDirectory(): Promise<string> {
  const packageRoots = [
    path.resolve(import.meta.dir, "../.."),
    path.resolve(import.meta.dir, ".."),
  ];
  for (const packageRoot of packageRoots) {
    const directory = path.join(packageRoot, "skills");
    if (
      await Bun.file(path.join(packageRoot, "package.json")).exists() &&
      await containsSkillFiles(directory)
    ) {
      return directory;
    }
  }
  throw new Error("The packaged seed skill directory is missing");
}

function buildSeedSkillLibrary(
  skills: readonly SeedSkill[],
): SeedSkillLibrary {
  const ids = new Set<string>();
  const grouped = new Map<string, SeedSkill[]>();
  const disciplines: SeedSkill[] = [];

  for (const skill of skills) {
    if (ids.has(skill.id)) {
      throw new Error(`Duplicate seed skill id: ${skill.id}`);
    }
    ids.add(skill.id);
    if (skill.axis === null) {
      disciplines.push(skill);
      continue;
    }
    const axisSkills = grouped.get(skill.axis) ?? [];
    axisSkills.push(skill);
    grouped.set(skill.axis, axisSkills);
  }

  const axes: SeedSkillAxis[] = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, axisSkills]) => {
      if (axisSkills.length < 2) {
        throw new Error(`Seed skill axis needs at least two options: ${id}`);
      }
      return { id, skills: axisSkills };
    });

  return { skills, axes, disciplines };
}

export async function loadSeedSkillLibrary(options: {
  readonly directory?: string;
} = {}): Promise<SeedSkillLibrary> {
  const directory = options.directory ?? await resolveSeedSkillDirectory();
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".md"))
    .sort();
  const skills = await Promise.all(
    filenames.map(async (filename) =>
      parseSeedSkillDocument({
        filename,
        text: await Bun.file(path.join(directory, filename)).text(),
      }),
    ),
  );
  return buildSeedSkillLibrary(skills);
}
