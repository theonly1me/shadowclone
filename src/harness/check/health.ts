import { lstat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { harnessMarkers, markedSection } from "../../integrations";
import { fingerprint, readLocalText } from "../../localFiles";
import { parseSkillDocument } from "../../skillMaintenance/document";
import type { HarnessManifest } from "../manifest";
import { repositorySkillRoots } from "../plan/skills";
import type { HarnessFinding } from "./types";

const maximumAgentsLines = 150;
const packageScriptsSchema = z.object({ scripts: z.record(z.string(), z.string()).optional() });
const refresh = "run `shadowclone sync`";

function error(options: { readonly rule: string; readonly path: string; readonly fix: string }): HarnessFinding {
  return { severity: "error", line: null, ...options };
}

function warning(options: { readonly rule: string; readonly path: string; readonly fix: string }): HarnessFinding {
  return { severity: "warning", line: null, ...options };
}

async function agentsFindings(options: { readonly root: string; readonly manifest: HarnessManifest }): Promise<readonly HarnessFinding[]> {
  const text = await readLocalText(path.join(options.root, "AGENTS.md"));
  if (text === null) return [error({ rule: "agents-missing", path: "AGENTS.md", fix: `AGENTS.md is missing; ${refresh} to restore it.` })];
  const section = markedSection({ text, markers: harnessMarkers });
  const findings: HarnessFinding[] = [];
  if (section === null) findings.push(error({ rule: "agents-section", path: "AGENTS.md", fix: `AGENTS.md lost its Shadowclone section; ${refresh}.` }));
  else if (fingerprint(section) !== options.manifest.artifacts["AGENTS.md"]) findings.push(warning({ rule: "agents-edited", path: "AGENTS.md", fix: `The Shadowclone section in AGENTS.md was edited. Move team notes outside the markers, then ${refresh}.` }));
  const lines = text.split("\n").length;
  if (lines > maximumAgentsLines) findings.push(warning({ rule: "agents-length", path: "AGENTS.md", fix: `AGENTS.md has ${lines} lines. Keep it at or under ${maximumAgentsLines} by linking to longer documents.` }));
  return findings;
}

async function claudeFindings(root: string): Promise<readonly HarnessFinding[]> {
  const filePath = path.join(root, "CLAUDE.md");
  if ((await lstat(filePath).catch(() => null))?.isSymbolicLink()) return [];
  const text = await readLocalText(filePath);
  const imports = text?.split("\n").some((line) => line.trim() === "@AGENTS.md") ?? false;
  return imports ? [] : [warning({ rule: "claude-import", path: "CLAUDE.md", fix: `CLAUDE.md does not import AGENTS.md, so Claude may not read it; ${refresh}.` })];
}

async function skillFindings(options: { readonly root: string; readonly manifest: HarnessManifest }): Promise<readonly HarnessFinding[]> {
  const findings: HarnessFinding[] = [];
  for (const name of options.manifest.skills) {
    for (const skillRoot of repositorySkillRoots) {
      const relativePath = `${skillRoot}/${name}/SKILL.md`;
      const text = await readLocalText(path.join(options.root, relativePath));
      let valid = false;
      try { valid = text !== null && parseSkillDocument(text).metadata.name === name; } catch { valid = false; }
      if (!valid) findings.push(error({ rule: "skill-invalid", path: relativePath, fix: `Skill ${name} is missing or its frontmatter is invalid; ${refresh} or fix its name and description.` }));
    }
  }
  return findings;
}

async function packageScripts(root: string): Promise<Readonly<Record<string, string>>> {
  const text = await readLocalText(path.join(root, "package.json"));
  if (text === null) return {};
  try {
    return packageScriptsSchema.parse(JSON.parse(text)).scripts ?? {};
  } catch {
    return {};
  }
}

async function gateFindings(options: { readonly root: string; readonly manifest: HarnessManifest }): Promise<readonly HarnessFinding[]> {
  const gate = options.manifest.gate;
  if (gate === null) return [warning({ rule: "gate-missing", path: ".shadowclone/harness.json", fix: `No gate was detected. Add a check script, then ${refresh}.` })];
  const scripts = [...gate.command.matchAll(/(?:^|&&\s*)(?:(?:bun|npm|pnpm) run|yarn) ([\w:.-]+)/g)].map((match) => match[1] ?? "");
  const declared = scripts.length === 0 ? {} : await packageScripts(options.root);
  const missing = scripts.filter((script) => !(script in declared));
  const findings = missing.map((script) => error({ rule: "gate-script", path: "package.json", fix: `The gate runs \`${gate.command}\`, but package.json has no \`${script}\` script. Restore it or ${refresh}.` }));
  const workflows = await Array.fromAsync(new Bun.Glob(".github/workflows/*.{yml,yaml}").scan({ cwd: options.root, dot: true }));
  const texts = await Promise.all(workflows.map((workflow) => Bun.file(path.join(options.root, workflow)).text()));
  if (!texts.some((workflowText) => workflowText.includes(gate.command))) findings.push(warning({ rule: "gate-ci", path: ".github/workflows", fix: `CI does not run \`${gate.command}\`. Add it to a workflow so every agent's change meets the same gate.` }));
  return findings;
}

export async function healthFindings(options: { readonly root: string; readonly manifest: HarnessManifest }): Promise<readonly HarnessFinding[]> {
  return [
    ...await agentsFindings(options),
    ...await claudeFindings(options.root),
    ...await skillFindings(options),
    ...await gateFindings(options),
  ];
}
