import path from "node:path";
import { compileContextDetails, stripHarnessSection } from "../../integrations";
import { readLocalText } from "../../localFiles";
import { canonicalPath, projectPaths, type ProjectPaths } from "../../paths";
import type { ProfileCompilation } from "../../profile";
import type { GitRemoteReader } from "../../signal";
import { deriveConventions, sourceExtensions, type Convention } from "../conventions";
import { detectRepository } from "../detect";
import { chooseGate, harnessCommands } from "../gate";
import { harnessManifestPath, readHarnessManifest, renderHarnessManifest } from "../manifest";
import { readPersonalSkill } from "../personalSkills";
import { renderAgentsSection, type ReadFirstSkill } from "../render/agents";
import { renderFeatureWorkflowSkill, renderHarnessBuilderSkill } from "../render/skills";
import type { HarnessCommand, HarnessGate, RepositoryFacts } from "../types";
import { importsAgentsFile, planManagedFile, type PlannedFile } from "./files";
import { carriedSkills, planSkillFiles } from "./skills";

export const harnessRuleByteBudget = 6_144;

export type HarnessPlan = {
  readonly root: string;
  readonly facts: RepositoryFacts;
  readonly gate: HarnessGate | null;
  readonly commands: readonly HarnessCommand[];
  readonly compilation: ProfileCompilation;
  readonly conventions: readonly Convention[];
  readonly skills: readonly ReadFirstSkill[];
  readonly personal: boolean;
  readonly files: readonly PlannedFile[];
};

export async function planHarness(options: {
  readonly root: string;
  readonly personal: boolean;
  readonly skillNames: readonly string[];
  readonly paths?: ProjectPaths;
  readonly configPath?: string;
  readonly managedConfigPath?: string | null;
  readonly readRemote?: GitRemoteReader;
}): Promise<HarnessPlan> {
  const paths = options.paths ?? projectPaths;
  const root = canonicalPath(options.root);
  const facts = await detectRepository(root);
  const manifest = await readHarnessManifest(root);
  const artifacts = manifest?.artifacts ?? {};
  const gate = chooseGate(facts);
  const details = await compileContextDetails({
    paths, cwd: root, configPath: options.configPath, managedConfigPath: options.managedConfigPath, readRemote: options.readRemote,
    scope: options.personal ? "combined" : "scoped", format: "harness", byteBudget: harnessRuleByteBudget,
    applicability: { tools: facts.tools, entries: new Set(facts.entries) }, nativeDuplicates: "excluding-harness",
  });
  if (details === null) throw new Error("Shadowclone is disabled by managed policy");
  const authored = [renderFeatureWorkflowSkill({ gate, adjustments: "" }), renderHarnessBuilderSkill()];
  const authoredNames = new Set(authored.map((skill) => skill.name));
  if (options.skillNames.some((name) => authoredNames.has(name))) throw new Error("A personal skill cannot replace a Shadowclone-authored skill");
  const personal = await Promise.all([...new Set(options.skillNames)].map((name) => readPersonalSkill({ paths, name })));
  const carried = await carriedSkills({ root, names: (manifest?.skills ?? []).filter((name) => !authoredNames.has(name) && !options.skillNames.includes(name)), artifacts });
  const [workflow, builder] = authored;
  const skills = [workflow, ...personal, ...carried.skills, builder].flatMap((skill) => skill === undefined ? [] : [{ name: skill.name, description: skill.description }]);
  const commands = harnessCommands({ facts, gate });
  const files = [
    await planManagedFile({ root, relativePath: "AGENTS.md", initial: "# Agent instructions", body: renderAgentsSection({ skills, commands, gate, rules: details.compilation.markdown }), expected: artifacts["AGENTS.md"], reason: "repository map for every agent" }),
    ...await planClaudeImport({ root, expected: artifacts["CLAUDE.md"] }),
    ...await planSkillFiles({ root, authored, personal, artifacts }),
  ];
  const conventions = deriveConventions({ ruleLines: details.compilation.markdown, facts });
  const recorded = Object.fromEntries(files.flatMap((file) => file.fingerprint === null ? [] : [[file.relativePath, file.fingerprint]]));
  const manifestText = renderHarnessManifest({
    version: 1, gate, personal: options.personal, conventions: [...conventions], sourceExtensions: [...sourceExtensions(facts)],
    skills: skills.map((skill) => skill.name), ruleKeys: [...details.compilation.appliedRuleKeys],
    artifacts: { ...carried.artifacts, ...recorded },
  });
  const previousManifest = await readLocalText(path.join(root, harnessManifestPath));
  const manifestPlan: PlannedFile = {
    relativePath: harnessManifestPath, previous: previousManifest, next: manifestText, fingerprint: null, reason: "gate, conventions, and artifact fingerprints",
    status: previousManifest === null ? "create" : previousManifest === manifestText ? "unchanged" : "update",
  };
  return { root, facts, gate, commands, compilation: details.compilation, conventions, skills, personal: options.personal, files: [...files, manifestPlan] };
}

async function planClaudeImport(options: { readonly root: string; readonly expected: string | undefined }): Promise<readonly PlannedFile[]> {
  const planned = await planManagedFile({ root: options.root, relativePath: "CLAUDE.md", initial: "# Claude instructions", body: "@AGENTS.md", expected: options.expected, reason: "imports AGENTS.md so Claude reads the same map" });
  if (planned.status === "preserved" || planned.status === "skipped" || options.expected !== undefined) return [planned];
  const importsAlready = importsAgentsFile(planned.previous === null ? null : stripHarnessSection(planned.previous));
  return importsAlready ? [{ ...planned, status: "skipped", next: null, fingerprint: null, reason: "already imports AGENTS.md" }] : [planned];
}
