import path from "node:path";
import { commitLocalChanges } from "../changes";
import { readEffectiveConfig } from "../config";
import { compileContext } from "../integrations";
import { fingerprint, readLocalText } from "../localFiles";
import { acquireLocalLock } from "../localFiles/lock";
import type { ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";
import { discoverSkills } from "./discover";
import { restoreOriginalSkill } from "./render";
import { registerPortableSkill } from "./portable";
import { isPluginCache, readMaintenanceState, skillTarget, writeMaintenanceState } from "./state";

export async function inspectSkillLibrary(options: { readonly paths: ProjectPaths; readonly managedConfigPath?: string | null; readonly readRemote?: GitRemoteReader }) {
  const { config } = await readEffectiveConfig({ configPath: options.paths.configFile, managedConfigPath: options.managedConfigPath === undefined ? options.paths.managedConfigFile : options.managedConfigPath });
  if (!config.sources["skill-library"]) throw new Error("Skill library access is disabled; run skills configure first");
  const state = await readMaintenanceState(options.paths);
  const roots = [];
  for (const root of state.roots) {
    if (!root.enabled) continue;
    if (await compileContext({ ...options, cwd: root.cwd, scope: root.scope === "global" ? "global" : "combined" }) !== null) roots.push(root);
  }
  return discoverSkills(roots);
}

export async function adoptSkill(options: { readonly paths: ProjectPaths; readonly id: string; readonly managedConfigPath?: string | null; readonly readRemote?: GitRemoteReader }): Promise<void> {
  const lock = await acquireLocalLock(path.join(options.paths.shadowcloneDirectory, "skills-worker.db"));
  if (!lock) throw new Error("Another skill update is running");
  try {
    const discovered = await inspectSkillLibrary(options);
    const skill = discovered.skills.find((entry) => entry.id === options.id);
    if (skill?.root.owner !== "user") throw new Error("Only a discovered user-owned skill can be adopted");
    if (isPluginCache(skill.root.directory)) throw new Error("Installed plugin caches cannot be adopted");
    const sourcePath = skillTarget({
      directory: skill.root.directory,
      relativePath: skill.relativePath,
    });
    const portable = await registerPortableSkill({
      paths: options.paths,
      name: skill.name,
      sourceDirectory: path.dirname(sourcePath),
      managedBy: "adopted",
    });
    const canonicalRelativePath = `${skill.name}/SKILL.md`;
    const canonicalPath = skillTarget({
      directory: path.dirname(portable.sourceDirectory),
      relativePath: canonicalRelativePath,
    });
    const canonicalText = await readLocalText(canonicalPath);
    if (canonicalText === null) {
      throw new Error("Portable skill installation did not produce SKILL.md");
    }
    const canonicalId = fingerprint(canonicalPath);
    const canonicalRootId = fingerprint(path.dirname(portable.sourceDirectory));
    const state = await readMaintenanceState(options.paths);
    await writeMaintenanceState({ paths: options.paths, state: {
      ...state, tracked: [...state.tracked.filter((entry) => entry.id !== skill.id && entry.id !== canonicalId), { id: canonicalId, rootId: canonicalRootId, relativePath: canonicalRelativePath, fingerprint: fingerprint(canonicalText), automatic: true, kind: "amend" }],
      assessed: Object.fromEntries(Object.entries(state.assessed).filter(([id]) => id !== skill.id && id !== canonicalId)),
    } });
  } finally { lock.release(); }
}

export async function skillRevisionRoots(paths: ProjectPaths): Promise<readonly string[]> {
  const state = await readMaintenanceState(paths);
  return [...new Set(state.roots.flatMap((root) => root.owner === "third-party" ? [root.destination] : [root.directory]))];
}

export async function removeSkillMaintenance(paths: ProjectPaths): Promise<number> {
  const state = await readMaintenanceState(paths);
  const groups = new Map<string, { filePath: string; previous: string; next: string | null }[]>();
  for (const tracked of state.tracked) {
    const root = state.roots.find((entry) => entry.id === tracked.rootId);
    if (!root) throw new Error("Tracked skill root is missing; maintenance state was preserved");
    const directory = tracked.kind === "companion" ? root.destination : root.directory;
    const filePath = skillTarget({ directory, relativePath: tracked.relativePath });
    const current = await readLocalText(filePath);
    if (current === null) continue;
    if (fingerprint(current) !== tracked.fingerprint) throw new Error("A maintained skill was edited; reconcile it before forgetting");
    const changes = groups.get(directory) ?? [];
    changes.push({ filePath, previous: current, next: tracked.kind === "companion" ? null : restoreOriginalSkill(current) });
    groups.set(directory, changes);
  }
  for (const [root, updates] of groups) await commitLocalChanges({ paths, root, kind: "skill", updates });
  await writeMaintenanceState({ paths, state: { ...state, tracked: [] } });
  return state.tracked.length;
}
