import path from "node:path";
import type { ProjectPaths } from "../paths";
import {
  parseProfileRules,
  readGeneratedProfileState,
  writeProfile,
} from "../profile";
import type {
  ExistingProfileRule,
  ProfileRule,
  ProfileRuleReference,
  ProfileWriteResult,
} from "../profile";
import type { SeedSkill, SeedSkillLibrary } from "./schema";

export function seedSkillProfileKey(skillId: string): string {
  return `seed:${skillId}`;
}

function profileRuleFromSeedSkill(skill: SeedSkill): ProfileRule {
  return {
    key: seedSkillProfileKey(skill.id),
    title: skill.title,
    body: skill.body,
    section: skill.section,
    scope: "global",
    originDirectory: null,
    source: "declared",
    status: "active",
    proposal: null,
    appliesWhen: skill.appliesWhen,
    evidence: { for: [], against: [] },
    observations: 0,
    lastSeen: "declared",
    sessions: 0,
    origins: [],
  };
}

async function existingRulesByKey(options: {
  readonly paths: ProjectPaths;
  readonly relativePaths: readonly string[];
}): Promise<ReadonlyMap<string, ExistingProfileRule>> {
  const rules = new Map<string, ExistingProfileRule>();
  for (const relativePath of new Set(options.relativePaths)) {
    const file = Bun.file(path.join(options.paths.profileDirectory, relativePath));
    if (!(await file.exists())) {
      continue;
    }
    for (const rule of parseProfileRules(await file.text())) {
      rules.set(rule.key, rule);
    }
  }
  return rules;
}

export async function writeSeedSkillSelection(options: {
  readonly paths: ProjectPaths;
  readonly library: SeedSkillLibrary;
  readonly selectedSkills: readonly SeedSkill[];
}): Promise<ProfileWriteResult> {
  const selectedKeys = new Set(
    options.selectedSkills.map((skill) => seedSkillProfileKey(skill.id)),
  );
  const libraryByKey = new Map(
    options.library.skills.map((skill) => [
      seedSkillProfileKey(skill.id),
      skill,
    ]),
  );
  const previous = (await readGeneratedProfileState(
    options.paths.profileManifestFile,
  )).filter(
    (entry) =>
      entry.disposition === "present" &&
      entry.source === "declared" &&
      libraryByKey.has(entry.key),
  );
  const existing = await existingRulesByKey({
    paths: options.paths,
    relativePaths: previous.map((entry) => entry.relativePath),
  });
  const rules = options.selectedSkills.map(profileRuleFromSeedSkill);
  const retired: ProfileRuleReference[] = [];

  for (const entry of previous) {
    if (selectedKeys.has(entry.key)) {
      continue;
    }
    const skill = libraryByKey.get(entry.key);
    if (!skill) {
      continue;
    }
    const current = existing.get(entry.key);
    if (!current) {
      rules.push(profileRuleFromSeedSkill(skill));
      continue;
    }
    if (current.edited || current.source === "user") {
      continue;
    }
    retired.push({ relativePath: entry.relativePath, key: entry.key });
  }

  return writeProfile({ paths: options.paths, rules, retired });
}
