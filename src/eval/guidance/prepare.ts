import os from "node:os";
import path from "node:path";
import { renderInstructionPointer } from "../../integrations/markdown";
import { materializeSnapshot } from "../../redact";
import { readScopedReferences, renderReference } from "../../references";
import { captureContext } from "../transfer/context";
import { command } from "../transfer/command";
import { loadEvaluationProfile } from "../transfer/profile";
import type { ResolvedTransferSetup } from "../transfer/setup";
import { fingerprint } from "../transfer/structured";
import { captureVerifiedMemory } from "./memory";
import { scenariosSchema, suiteSchema, type GuidanceSuite } from "./schema";
import { saveGuidanceSuite } from "./store";

export async function readGuidanceScenarios(filePath: string) {
  const absolute = path.resolve(filePath);
  const snapshot = await materializeSnapshot({ filePath: absolute, roots: [absolute], maximumBytes: 65536, parse: () => null });
  if (snapshot === null) throw new Error("Scenario file could not be read safely");
  return scenariosSchema.parse(JSON.parse(snapshot.redacted));
}

export function validateScenarios(suite: GuidanceSuite): void {
  const sources = [...suite.context, ...suite.memory, ...suite.references, { relativePath: "profile.md", content: suite.profile }];
  if (new Set(suite.scenarios.map((scenario) => scenario.id)).size !== suite.scenarios.length) throw new Error("Scenario IDs must be unique");
  const pilot = suite.scenarios.filter((scenario) => scenario.pilot);
  if (pilot.length !== 2 || !pilot.some((scenario) => scenario.mode === "code") || !pilot.some((scenario) => scenario.mode === "advice")) throw new Error("Pilot requires one code case and one advice case");
  for (const file of [...suite.context, ...suite.memory, ...suite.references]) {
    if (path.isAbsolute(file.relativePath) || file.relativePath.split(/[\\/]/).some((segment) => segment === "..")) throw new Error("Unsafe frozen context path");
  }
  if (suite.context.some((file) => !file.relativePath.startsWith("skills/") && !file.relativePath.startsWith("instructions/")) ||
    suite.memory.some((file) => !file.relativePath.startsWith("memory/")) ||
    suite.references.some((file) => !file.relativePath.startsWith("references/"))) throw new Error("Context source is assigned to the wrong condition");
  for (const scenario of suite.scenarios) {
    if (new Set(scenario.criteria.map((criterion) => criterion.id)).size !== scenario.criteria.length) throw new Error("Criterion IDs must be unique within each case");
    if (scenario.mode === "advice" && scenario.criteria.some((criterion) => criterion.check !== "judged")) throw new Error("Advice cases cannot require code checks");
    for (const criterion of scenario.criteria) {
      const source = sources.find((file) => file.relativePath === criterion.source.path);
      if (!source?.content.includes(criterion.source.quote)) throw new Error(`Criterion source quotation is missing: ${criterion.id}`);
    }
    for (const skill of scenario.expectedSkills) {
      if (!suite.context.some((file) => file.relativePath.endsWith(`/${skill}/SKILL.md`))) throw new Error(`Expected skill is unavailable: ${skill}`);
    }
    for (const reference of scenario.expectedReferences) {
      if (![...suite.memory, ...suite.references].some((file) => file.relativePath.endsWith(`/${reference}`))) throw new Error("Expected memory reference is unavailable");
    }
  }
}

export async function prepareGuidanceSuite(options: {
  readonly setup: ResolvedTransferSetup;
  readonly scenarioFile: string;
  readonly memorySource: string;
  readonly memoryManifest: string;
}): Promise<GuidanceSuite> {
  if (!options.setup.config.sources["agent-context"] || !options.setup.config.sources["skill-library"]) throw new Error("Guidance evaluation requires agent-context and skill-library consent");
  const scenarios = await readGuidanceScenarios(options.scenarioFile);
  const personal = await captureContext({ enabled: true, home: os.homedir(), repository: options.setup.repository, engine: "claude-code" });
  const context = personal.filter((file) => !file.relativePath.startsWith("memory/"));
  const memory = [...await captureVerifiedMemory({ directory: options.memorySource, manifestPath: options.memoryManifest })];
  const profile = await loadEvaluationProfile({ profileDirectory: options.setup.paths.profileDirectory, repository: options.setup.repositoryIdentity });
  const references = (await readScopedReferences({
    profileDirectory: options.setup.paths.profileDirectory,
    origin: options.setup.repositoryIdentity.origin,
    targetRepo: options.setup.repositoryIdentity.profileFileName,
  })).map(({ record }) => ({ relativePath: `references/${record.key}.md`, content: renderReference(record) }));
  const suite = suiteSchema.parse({
    protocol: "guidance-v1", schemaVersion: 1, suiteId: crypto.randomUUID(),
    repository: options.setup.repository,
    baseCommit: await command({ arguments: ["git", "rev-parse", "HEAD"], cwd: options.setup.repository }),
    context, memory, references, profile: profile.markdown, bootstrap: renderInstructionPointer(),
    sourcesFingerprint: fingerprint({ context, memory, references, profile: profile.markdown }),
    scenarios: scenarios.scenarios,
  });
  validateScenarios(suite);
  await saveGuidanceSuite({ paths: options.setup.paths, suite });
  return suite;
}
