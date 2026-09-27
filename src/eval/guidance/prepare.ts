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
import { captureCurrentMemory, captureVerifiedMemory } from "./memory";
import { scenariosSchema, suiteSchema, type GuidanceSuite, type guidanceProtocols } from "./schema";
import { saveGuidanceSuite } from "./store";
import { captureSkillComparison } from "../../environment/comparison";

export async function readGuidanceScenarios(filePath: string) {
  const absolute = path.resolve(filePath);
  const snapshot = await materializeSnapshot({ filePath: absolute, roots: [absolute], maximumBytes: 65536, parse: () => null });
  if (snapshot === null) throw new Error("Scenario file could not be read safely");
  return scenariosSchema.parse(JSON.parse(snapshot.redacted));
}

export function validateScenarios(suite: GuidanceSuite): void {
  const sources = [...suite.context, ...(suite.maintainedContext ?? []), ...suite.memory, ...suite.references, { relativePath: "profile.md", content: suite.profile }];
  if (suite.protocol === "guidance-skills-v1" && (!suite.maintainedContext?.length || suite.profile || suite.bootstrap || suite.references.length)) throw new Error("Skills protocol requires separate maintained context without a profile overlay or reference store");
  if (suite.protocol !== "guidance-skills-v1" && (!suite.profile || !suite.bootstrap || suite.maintainedContext)) throw new Error("Historical guidance protocols retain their original delivery contract");
  if (suite.protocol === "guidance-v2") {
    if (Buffer.byteLength(suite.profile, "utf8") > 4096) throw new Error("Current guidance profile exceeds the native startup limit");
    if (suite.memoryHashes?.length !== suite.memory.length || suite.memoryHashes.some((entry) =>
      !suite.memory.some((file) => file.relativePath === `memory/${entry.filename}`)
    )) throw new Error("Current Claude memory hashes do not match the frozen files");
  }
  if (new Set(suite.scenarios.map((scenario) => scenario.id)).size !== suite.scenarios.length) throw new Error("Scenario IDs must be unique");
  const pilot = suite.scenarios.filter((scenario) => scenario.pilot);
  if (pilot.length !== 2 || !pilot.some((scenario) => scenario.mode === "code") || !pilot.some((scenario) => scenario.mode === "advice")) throw new Error("Pilot requires one code case and one advice case");
  for (const file of [...suite.context, ...(suite.maintainedContext ?? []), ...suite.memory, ...suite.references]) {
    if (path.isAbsolute(file.relativePath) || file.relativePath.split(/[\\/]/).some((segment) => segment === "..")) throw new Error("Unsafe frozen context path");
  }
  if ([...suite.context, ...(suite.maintainedContext ?? [])].some((file) => !file.relativePath.startsWith("skills/") && !file.relativePath.startsWith("instructions/")) ||
    suite.memory.some((file) => !file.relativePath.startsWith("memory/")) ||
    suite.references.some((file) => !file.relativePath.startsWith("references/"))) throw new Error("Context source is assigned to the wrong condition");
  for (const scenario of suite.scenarios) {
    if (new Set(scenario.criteria.map((criterion) => criterion.id)).size !== scenario.criteria.length) throw new Error("Criterion IDs must be unique within each case");
    if (scenario.mode === "advice" && scenario.criteria.some((criterion) => criterion.check !== "judged")) throw new Error("Advice cases cannot require code checks");
    for (const criterion of scenario.criteria) {
      if (!sources.some((file) => file.relativePath === criterion.source.path && file.content.includes(criterion.source.quote))) throw new Error(`Criterion source quotation is missing: ${criterion.id}`);
    }
    for (const skill of scenario.expectedSkills) {
      if (![...suite.context, ...(suite.maintainedContext ?? [])].some((file) => file.relativePath.endsWith(`/${skill}/SKILL.md`))) throw new Error(`Expected skill is unavailable: ${skill}`);
    }
    for (const reference of scenario.expectedReferences) {
      if (![...suite.memory, ...suite.references].some((file) => file.relativePath.endsWith(`/${reference}`))) throw new Error("Expected memory reference is unavailable");
    }
  }
}

export async function prepareGuidanceSuite(options: {
  readonly setup: ResolvedTransferSetup;
  readonly protocol: (typeof guidanceProtocols)[number];
  readonly scenarioFile: string;
  readonly memorySource: string;
  readonly memoryManifest?: string;
}): Promise<GuidanceSuite> {
  if (!options.setup.config.sources["agent-context"] || !options.setup.config.sources["skill-library"]) throw new Error("Guidance evaluation requires agent-context and skill-library consent");
  const scenarios = await readGuidanceScenarios(options.scenarioFile);
  if (scenarios.protocol !== options.protocol) throw new Error("Scenario protocol does not match the requested evaluation protocol");
  if (options.protocol === "guidance-skills-v1") {
    const comparison = await captureSkillComparison({ paths: options.setup.paths, repository: options.setup.repository });
    const memory = await captureCurrentMemory(options.memorySource);
    const suite = suiteSchema.parse({ protocol: options.protocol, schemaVersion: 1, suiteId: crypto.randomUUID(), repository: options.setup.repository,
      baseCommit: await command({ arguments: ["git", "rev-parse", "HEAD"], cwd: options.setup.repository }),
      context: comparison.original, maintainedContext: comparison.maintained, memory: memory.files, memoryHashes: memory.hashes, references: [], profile: "", bootstrap: "",
      sourcesFingerprint: fingerprint({ comparison, memory }), scenarios: scenarios.scenarios });
    validateScenarios(suite);
    await saveGuidanceSuite({ paths: options.setup.paths, suite });
    return suite;
  }
  const personal = await captureContext({ enabled: true, home: os.homedir(), repository: options.setup.repository, engine: "claude-code" });
  const context = personal.filter((file) => !file.relativePath.startsWith("memory/"));
  const currentMemory = options.protocol === "guidance-v2" ? await captureCurrentMemory(options.memorySource) : null;
  if (options.protocol === "guidance-v1" && !options.memoryManifest) throw new Error("Historical guidance evaluation requires a migration manifest");
  const memory = currentMemory?.files ?? await captureVerifiedMemory({ directory: options.memorySource, manifestPath: options.memoryManifest ?? "" });
  const profile = options.protocol === "guidance-v2"
    ? await loadEvaluationProfile({ delivery: "startup", cwd: options.setup.repository, paths: options.setup.paths })
    : await loadEvaluationProfile({ profileDirectory: options.setup.paths.profileDirectory, repository: options.setup.repositoryIdentity });
  const references = (await readScopedReferences({
    profileDirectory: options.setup.paths.profileDirectory,
    origin: options.setup.repositoryIdentity.origin,
    targetRepo: options.setup.repositoryIdentity.profileFileName,
  })).map(({ record }) => ({ relativePath: `references/${record.key}.md`, content: renderReference(record) }));
  const suite = suiteSchema.parse({
    protocol: options.protocol, schemaVersion: 1, suiteId: crypto.randomUUID(),
    repository: options.setup.repository,
    baseCommit: await command({ arguments: ["git", "rev-parse", "HEAD"], cwd: options.setup.repository }),
    context, memory, ...(currentMemory ? { memoryHashes: currentMemory.hashes } : {}), references, profile: profile.markdown, bootstrap: renderInstructionPointer(),
    sourcesFingerprint: fingerprint({ context, memory, references, profile: profile.markdown }),
    scenarios: scenarios.scenarios,
  });
  validateScenarios(suite);
  await saveGuidanceSuite({ paths: options.setup.paths, suite });
  return suite;
}
