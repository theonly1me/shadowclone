import path from "node:path";
import { lstat } from "node:fs/promises";
import { z } from "zod";
import type { ProjectPaths } from "../paths";
import { canonicalPath } from "../paths";
import { readLocalText, assertRegularDestination } from "../localFiles";
import { materializeSnapshot } from "../redact";
import { stripManagedGuidance } from "../integrations";
import { readMaintenanceState } from "../skillMaintenance/state";
import { discoverDeliverySkills } from "../skillMaintenance/discover";
import type { ContextFile } from "../eval/transfer/types";
import { readRedactedEnvironment } from "./store";
import { renderSkillRouting } from "./context";
import { learningScopes } from "./scope";

const baselineSchema = z.object({
  version: z.literal(1),
  files: z.array(z.object({ source: z.string(), relativePath: z.string(), hash: z.string(), scope: z.string().optional(), cwd: z.string().nullable().optional() })),
  skills: z.array(z.object({ id: z.string(), name: z.string(), scope: z.string(), cwd: z.string().nullable() })),
});

async function capturedFile(options: { readonly filePath: string; readonly relativePath: string }): Promise<ContextFile> {
  assertRegularDestination(options.filePath);
  const file = Bun.file(options.filePath);
  if (file.size > 8_000_000) throw new Error("Evaluation skill resource exceeds its snapshot limit");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { binary = true; }
  const mode = (await lstat(options.filePath)).mode & 0o777;
  if (binary) return { relativePath: options.relativePath, content: Buffer.from(bytes).toString("base64"), encoding: "base64", mode };
  const snapshot = await materializeSnapshot({ filePath: options.filePath, roots: [options.filePath], maximumBytes: 2_000_000, parse: () => null });
  if (snapshot === null) throw new Error("Evaluation skill resource changed during capture");
  return { relativePath: options.relativePath, content: snapshot.redacted, mode };
}

export async function captureSkillComparison(options: { readonly paths: ProjectPaths; readonly repository: string }): Promise<{ readonly original: readonly ContextFile[]; readonly maintained: readonly ContextFile[] }> {
  const state = await readRedactedEnvironment(options.paths);
  if (state?.phase !== "active" || !state.baselineDirectory) throw new Error("Skills evaluation requires an active environment and its original baseline");
  const baselineDirectory = canonicalPath(state.baselineDirectory);
  if (!baselineDirectory.startsWith(`${canonicalPath(path.join(options.paths.shadowcloneDirectory, "environment-baselines"))}${path.sep}`)) throw new Error("Original baseline is outside the local snapshot store");
  const manifest = baselineSchema.parse(JSON.parse(await readLocalText(path.join(baselineDirectory, "manifest.json")) ?? "null"));
  const original: ContextFile[] = [];
  const maintained: ContextFile[] = [];
  const replacements = new Map<string, string>();
  for (const file of manifest.files) {
    const [kind, id, ...parts] = file.relativePath.split("/");
    const skill = kind === "skills" ? manifest.skills.find((entry) => entry.id === id) : null;
    if (skill && (skill.scope === "repository" && skill.cwd !== options.repository || ["shadowclone-context", "shadowclone"].includes(skill.name))) continue;
    if (!skill && (!/^(?:AGENTS(?:\.override)?|CLAUDE)\.md$/.test(path.basename(file.source)) || file.scope === "repository" && file.cwd !== options.repository)) continue;
    const source = path.resolve(baselineDirectory, file.relativePath);
    if (!source.startsWith(`${baselineDirectory}${path.sep}`)) throw new Error("Unsafe original baseline entry");
    assertRegularDestination(source);
    if (new Bun.CryptoHasher("sha256").update(await Bun.file(source).arrayBuffer()).digest("hex") !== file.hash) throw new Error("Original baseline changed after migration");
    const relativePath = skill ? `skills/${id}/${skill.name}/${parts.join("/")}` : `instructions/${original.length}/${path.basename(file.source)}`;
    const captured = await capturedFile({ filePath: source, relativePath });
    original.push(skill ? captured : { ...captured, content: stripManagedGuidance(captured.content) });
  }
  const roots = (await readMaintenanceState(options.paths)).roots.filter((root) => root.enabled && (root.scope === "global" || root.cwd === options.repository));
  const { skills } = await discoverDeliverySkills(roots);
  for (const skill of skills.filter((entry) => !["shadowclone-context", "shadowclone"].includes(entry.name))) {
    const directory = path.dirname(path.join(skill.root.directory, skill.relativePath));
    for await (const relative of new Bun.Glob("**/*").scan({ cwd: directory, dot: true, onlyFiles: true, followSymlinks: false })) {
      const relativePath = `skills/${skill.id}/${skill.name}/${relative}`;
      const source = path.join(directory, relative);
      maintained.push(await capturedFile({ filePath: source, relativePath }));
      replacements.set(source, `.eval-context/${relativePath}`);
    }
  }
  const scopes = learningScopes({ paths: options.paths, state }).filter((scope) => scope.repository === null || scope.directory === options.repository);
  const instructions = new Set([
    ...manifest.files.filter((file) => /^(?:AGENTS(?:\.override)?|CLAUDE)\.md$/.test(path.basename(file.source)) && (file.scope !== "repository" || file.cwd === options.repository)).map((file) => file.source),
    ...state.artifacts.filter((artifact) => artifact.kind === "instructions" && scopes.some((scope) => scope.key === artifact.scope)).map((artifact) => artifact.filePath),
  ]);
  for (const source of instructions) {
    if (!await Bun.file(source).exists()) continue;
    const captured = await capturedFile({ filePath: source, relativePath: `instructions/${maintained.length}/${path.basename(source)}` });
    maintained.push({ ...captured, content: stripManagedGuidance(captured.content) });
  }
  let routing = renderSkillRouting({ state, scopes });
  for (const [source, replacement] of replacements) routing = routing.replaceAll(source, replacement);
  if (state.artifacts.some((artifact) => artifact.kind === "skill" && scopes.some((scope) => scope.key === artifact.scope) && routing.includes(artifact.filePath))) throw new Error("A maintained route was not captured in the frozen skill library");
  maintained.push({ relativePath: "instructions/routing.md", content: routing });
  if (Buffer.byteLength(JSON.stringify({ original, maintained })) > 128_000_000) throw new Error("Skill comparison exceeds the frozen suite budget");
  return { original, maintained };
}
