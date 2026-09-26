import { rm } from "node:fs/promises";
import { canonicalPath, type ProjectPaths } from "../paths";
import {
  portableSkillNameSchema,
  readPortableSkills,
  replaceSkillDirectory,
  skillTreeFingerprint,
  writePortableSkills,
  type PortableSkill,
} from "./portableFiles";
import {
  portableSkillDirectories,
  redundantCodexSkillDirectory,
} from "./portableLocations";

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
  const [canonical, ...replicas] = portableSkillDirectories({
    paths: options.paths,
    name: options.name,
  });
  if (!canonical) {
    throw new Error("Portable skill destination is unavailable");
  }
  const redundantCodex = redundantCodexSkillDirectory(options);
  const destinations = [canonical, ...replicas, redundantCodex].filter(
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
  if (await skillTreeFingerprint(redundantCodex) === sourceFingerprint) {
    await rm(redundantCodex, { recursive: true, force: true });
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
  const expected = new Set(portableSkillDirectories({
    paths: options.paths,
    name: options.name,
  }));
  const redundantCodex = redundantCodexSkillDirectory(options);
  const allowed = new Set([...expected, redundantCodex]);
  const recorded = [skill.sourceDirectory, ...skill.replicaDirectories];
  const resolvedRecorded = recorded.map(canonicalPath);
  if (
    resolvedRecorded.some((directory) => !allowed.has(directory)) ||
    [...expected].some((directory) => !resolvedRecorded.includes(directory))
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
    const expected = portableSkillDirectories({ paths: options.paths, name: skill.name });
    const [canonical, ...replicas] = expected;
    if (canonical === undefined) throw new Error("Portable skill destination is unavailable");
    const redundantCodex = redundantCodexSkillDirectory({
      paths: options.paths,
      name: skill.name,
    });
    const directories = [...new Set([
      skill.sourceDirectory,
      ...skill.replicaDirectories,
      ...expected,
    ].map(canonicalPath))].filter((directory) => directory !== redundantCodex);
    const states = await Promise.all(directories.map(async (directory) => ({
      directory,
      fingerprint: await skillTreeFingerprint(directory),
    })));
    const codexFingerprint = await skillTreeFingerprint(redundantCodex);
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
    if (
      codexFingerprint !== null &&
      codexFingerprint !== skill.baselineFingerprint &&
      codexFingerprint !== authority.fingerprint
    ) {
      conflicts += 1;
      updated.push(skill);
      continue;
    }
    for (const state of states.filter((entry) => expected.includes(entry.directory))) {
      if (state.fingerprint !== authority.fingerprint) {
        await replaceSkillDirectory({
          source: authority.directory,
          destination: state.directory,
        });
        synced += 1;
      }
    }
    if (
      codexFingerprint === authority.fingerprint ||
      codexFingerprint === skill.baselineFingerprint
    ) {
      await rm(redundantCodex, { recursive: true, force: true });
      synced += 1;
    }
    updated.push({
      ...skill,
      sourceDirectory: canonical,
      replicaDirectories: replicas,
      baselineFingerprint: authority.fingerprint,
    });
  }
  await writePortableSkills({ paths: options.paths, skills: updated });
  return { synced, conflicts };
}

export { readPortableSkills, skillTreeFingerprint } from "./portableFiles";
