import path from "node:path";
import { readLocalText, replaceLocalText } from "../localFiles";
import type { ProjectPaths } from "../paths";
import { resolveRedacted } from "../redact";
import { acquireLocalLock } from "../localFiles/lock";
import { maintenanceStateSchema, type MaintenanceState } from "./types";

export async function readMaintenanceState(paths: ProjectPaths): Promise<MaintenanceState> {
  const text = await readLocalText(path.join(paths.shadowcloneDirectory, "skills.json"));
  if (text === null) return { version: 1, roots: [], tracked: [], assessed: {}, findings: {}, rejected: {} };
  try { return maintenanceStateSchema.parse(JSON.parse(text)); }
  catch { throw new Error("Invalid skill maintenance state"); }
}

export async function writeMaintenanceState(options: { readonly paths: ProjectPaths; readonly state: MaintenanceState }): Promise<void> {
  const filePath = path.join(options.paths.shadowcloneDirectory, "skills.json");
  await replaceLocalText({ filePath, previous: await readLocalText(filePath), next: `${JSON.stringify(maintenanceStateSchema.parse(options.state), null, 2)}\n` });
}

export function skillTarget(options: { readonly directory: string; readonly relativePath: string }): string {
  const segments = options.relativePath.split("/");
  if (path.isAbsolute(options.relativePath) || segments.some((segment) => !segment || segment === "." || segment === "..") || options.relativePath.includes("\\") || segments.at(-1) !== "SKILL.md") throw new Error("Invalid skill destination");
  const target = path.resolve(options.directory, options.relativePath);
  if (!target.startsWith(`${path.resolve(options.directory)}${path.sep}`)) throw new Error("Skill destination escapes its root");
  return target;
}

export function isPluginCache(directory: string): boolean {
  return /(?:^|[/\\])plugins[/\\]cache(?:[/\\]|$)/i.test(directory);
}

export async function showSkillRoots(paths: ProjectPaths): Promise<string> {
  const sourcePath = path.join(paths.shadowcloneDirectory, "skills.json");
  const file = Bun.file(sourcePath);
  if (!(await file.exists())) return "[]";
  const text = await resolveRedacted({ ref: { type: "file", sourcePath, byteOffset: 0, byteLength: file.size } });
  try { return JSON.stringify(maintenanceStateSchema.parse(JSON.parse(text)).roots, null, 2); }
  catch { throw new Error("Invalid skill maintenance state"); }
}

export async function disableSkillRoot(options: { readonly paths: ProjectPaths; readonly id: string }): Promise<void> {
  const lock = await acquireLocalLock(path.join(options.paths.shadowcloneDirectory, "skills-worker.db"));
  if (!lock) throw new Error("Another skill update is running");
  try {
  const state = await readMaintenanceState(options.paths);
  if (!state.roots.some((root) => root.id === options.id)) throw new Error("Skill root was not found");
  await writeMaintenanceState({ paths: options.paths, state: { ...state, roots: state.roots.map((root) => root.id === options.id ? { ...root, enabled: false } : root) } });
  } finally { lock.release(); }
}
