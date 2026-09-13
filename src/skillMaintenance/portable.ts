import { rm } from "node:fs/promises";
import path from "node:path";
import { canonicalPath, type ProjectPaths } from "../paths";
import {
  portableSkillNameSchema,
  readPortableSkills,
  replaceSkillDirectory,
  skillTreeFingerprint,
  writePortableSkills,
  type PortableSkill,
} from "./portableFiles";

function skillDirectories(options: {
  readonly paths: ProjectPaths;
  readonly name: string;
}): readonly string[] {
  const home = path.dirname(options.paths.shadowcloneDirectory);
  const codexHome = path.dirname(options.paths.codexSessionsDirectory);
  return [
    path.join(home, ".agents/skills", options.name),
    path.join(home, ".claude/skills", options.name),
    path.join(codexHome, "skills", options.name),
    path.join(home, ".cursor/skills", options.name),
    path.join(home, ".gemini/config/skills", options.name),
  ].map(canonicalPath);
}

export async function registerPortableSkill(options: {
  readonly paths: ProjectPaths;
  readonly name: string;
  readonly sourceDirectory: string;
  readonly managedBy: PortableSkill["managedBy"];
}): Promise<PortableSkill> {
  portableSkillNameSchema.parse(options.name);
  const sourceDirectory = canonicalPath(options.sourceDirectory);
  const sourceFingerprint = await skillTreeFingerprint(sourceDirectory);
  if (!sourceFingerprint) {
    throw new Error("Portable skill source is missing");
  }
  const [canonical, ...replicas] = skillDirectories({
    paths: options.paths,
    name: options.name,
  });
  if (!canonical) {
    throw new Error("Portable skill destination is unavailable");
  }
  const destinations = [canonical, ...replicas].filter(
    (directory) => directory !== sourceDirectory,
  );
  for (const destination of destinations) {
    const current = await skillTreeFingerprint(destination);
    if (current !== null && current !== sourceFingerprint) {
      throw new Error("A different skill already exists at a portable destination");
    }
  }
  if (sourceDirectory !== canonical) {
    await replaceSkillDirectory({ source: sourceDirectory, destination: canonical });
  }
  for (const destination of replicas) {
    if (
      destination !== sourceDirectory &&
      await skillTreeFingerprint(destination) === null
    ) {
      await replaceSkillDirectory({ source: canonical, destination });
    }
  }
  const skills = await readPortableSkills(options.paths);
  const entry: PortableSkill = {
    name: options.name,
    sourceDirectory: canonical,
    replicaDirectories: replicas,
    baselineFingerprint: sourceFingerprint,
    installationFingerprint: sourceFingerprint,
    managedBy: options.managedBy,
  };
  await writePortableSkills({
    paths: options.paths,
    skills: [...skills.filter((skill) => skill.name !== options.name), entry],
  });
  return entry;
}

export async function retireStarterSkill(options: {
  readonly paths: ProjectPaths;
  readonly name: string;
}): Promise<"removed" | "preserved" | "unmanaged"> {
  const skills = await readPortableSkills(options.paths);
  const skill = skills.find((entry) => entry.name === options.name);
  if (skill?.managedBy !== "starter") {
    return "unmanaged";
  }
  if (skill.baselineFingerprint !== skill.installationFingerprint) {
    await writePortableSkills({
      paths: options.paths,
      skills: skills.map((entry) => entry.name === skill.name
        ? { ...entry, managedBy: "adopted" }
        : entry),
    });
    return "preserved";
  }
  const expected = new Set(skillDirectories({
    paths: options.paths,
    name: options.name,
  }));
  const recorded = [skill.sourceDirectory, ...skill.replicaDirectories];
  const resolvedRecorded = recorded.map(canonicalPath);
  if (
    expected.size !== new Set(resolvedRecorded).size ||
    resolvedRecorded.some((directory) => !expected.has(directory))
  ) {
    throw new Error("Portable skill state contains an unsafe destination");
  }
  for (const directory of recorded) {
    await rm(directory, { recursive: true, force: true });
  }
  await writePortableSkills({
    paths: options.paths,
    skills: skills.filter((entry) => entry.name !== skill.name),
  });
  return "removed";
}

export async function syncPortableSkills(options: {
  readonly paths: ProjectPaths;
}): Promise<{ readonly synced: number; readonly conflicts: number }> {
  const skills = await readPortableSkills(options.paths);
  const updated: PortableSkill[] = [];
  let synced = 0;
  let conflicts = 0;
  for (const skill of skills) {
    const directories = [skill.sourceDirectory, ...skill.replicaDirectories];
    const states = await Promise.all(directories.map(async (directory) => ({
      directory,
      fingerprint: await skillTreeFingerprint(directory),
    })));
    const changed = states.filter((state) =>
      state.fingerprint !== null &&
      state.fingerprint !== skill.baselineFingerprint
    );
    if (new Set(changed.map((state) => state.fingerprint)).size > 1) {
      conflicts += 1;
      updated.push(skill);
      continue;
    }
    const authority = changed[0] ?? states.find((state) => state.fingerprint);
    if (!authority?.fingerprint) {
      conflicts += 1;
      updated.push(skill);
      continue;
    }
    for (const state of states) {
      if (state.fingerprint !== authority.fingerprint) {
        await replaceSkillDirectory({
          source: authority.directory,
          destination: state.directory,
        });
        synced += 1;
      }
    }
    updated.push({ ...skill, baselineFingerprint: authority.fingerprint });
  }
  await writePortableSkills({ paths: options.paths, skills: updated });
  return { synced, conflicts };
}

export { readPortableSkills, skillTreeFingerprint } from "./portableFiles";
