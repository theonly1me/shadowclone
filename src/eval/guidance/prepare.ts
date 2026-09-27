import os from "node:os";
import { renderInstructionPointer } from "../../integrations/markdown";
import { readScopedReferences, renderReference } from "../../references";
import { captureContext } from "../transfer/context";
import { command } from "../transfer/command";
import { loadEvaluationProfile } from "../transfer/profile";
import type { ResolvedTransferSetup } from "../transfer/setup";
import { fingerprint } from "../transfer/structured";
import { captureCurrentMemory, captureVerifiedMemory } from "./memory";
import {
  suiteSchema,
  type GuidanceSuite,
  type guidanceProtocols,
} from "./schema";
import { saveGuidanceSuite } from "./store";
import { captureSkillComparison } from "../../environment/comparison";
import { readGuidanceScenarios, validateScenarios } from "./scenarios";

export { readGuidanceScenarios, validateScenarios } from "./scenarios";

export async function prepareGuidanceSuite(options: {
  readonly setup: ResolvedTransferSetup;
  readonly protocol: (typeof guidanceProtocols)[number];
  readonly scenarioFile: string;
  readonly memorySource: string;
  readonly memoryManifest?: string;
}): Promise<GuidanceSuite> {
  if (
    !options.setup.config.sources["agent-context"] ||
    !options.setup.config.sources["skill-library"]
  ) {
    throw new Error(
      "Guidance evaluation requires agent-context and skill-library consent",
    );
  }

  const scenarios = await readGuidanceScenarios(options.scenarioFile);

  if (scenarios.protocol !== options.protocol) {
    throw new Error(
      "Scenario protocol does not match the requested evaluation protocol",
    );
  }

  if (options.protocol === "guidance-skills-v1") {
    const comparison = await captureSkillComparison({
      paths: options.setup.paths,
      repository: options.setup.repository,
    });
    const memory = await captureCurrentMemory(options.memorySource);

    const suite = suiteSchema.parse({
      protocol: options.protocol,
      schemaVersion: 1,
      suiteId: crypto.randomUUID(),
      repository: options.setup.repository,
      baseCommit: await command({
        arguments: ["git", "rev-parse", "HEAD"],
        cwd: options.setup.repository,
      }),
      context: comparison.original,
      maintainedContext: comparison.maintained,
      memory: memory.files,
      memoryHashes: memory.hashes,
      references: [],
      profile: "",
      bootstrap: "",
      sourcesFingerprint: fingerprint({ comparison, memory }),
      scenarios: scenarios.scenarios,
    });

    validateScenarios(suite);
    await saveGuidanceSuite({ paths: options.setup.paths, suite });

    return suite;
  }

  const personal = await captureContext({
    enabled: true,
    home: os.homedir(),
    repository: options.setup.repository,
    engine: "claude-code",
  });

  const context = personal.filter(
    (file) => !file.relativePath.startsWith("memory/"),
  );
  const currentMemory =
    options.protocol === "guidance-v2"
      ? await captureCurrentMemory(options.memorySource)
      : null;

  if (options.protocol === "guidance-v1" && !options.memoryManifest) {
    throw new Error(
      "Historical guidance evaluation requires a migration manifest",
    );
  }

  const memory =
    currentMemory?.files ??
    (await captureVerifiedMemory({
      directory: options.memorySource,
      manifestPath: options.memoryManifest ?? "",
    }));

  const profile =
    options.protocol === "guidance-v2"
      ? await loadEvaluationProfile({
          delivery: "startup",
          cwd: options.setup.repository,
          paths: options.setup.paths,
        })
      : await loadEvaluationProfile({
          profileDirectory: options.setup.paths.profileDirectory,
          repository: options.setup.repositoryIdentity,
        });

  const references = (
    await readScopedReferences({
      profileDirectory: options.setup.paths.profileDirectory,
      origin: options.setup.repositoryIdentity.origin,
      targetRepo: options.setup.repositoryIdentity.profileFileName,
    })
  ).map(({ record }) => ({
    relativePath: `references/${record.key}.md`,
    content: renderReference(record),
  }));

  const suite = suiteSchema.parse({
    protocol: options.protocol,
    schemaVersion: 1,
    suiteId: crypto.randomUUID(),
    repository: options.setup.repository,
    baseCommit: await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: options.setup.repository,
    }),
    context,
    memory,
    ...(currentMemory ? { memoryHashes: currentMemory.hashes } : {}),
    references,
    profile: profile.markdown,
    bootstrap: renderInstructionPointer(),
    sourcesFingerprint: fingerprint({
      context,
      memory,
      references,
      profile: profile.markdown,
    }),
    scenarios: scenarios.scenarios,
  });

  validateScenarios(suite);
  await saveGuidanceSuite({ paths: options.setup.paths, suite });

  return suite;
}
