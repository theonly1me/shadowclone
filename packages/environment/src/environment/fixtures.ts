import path from "node:path";
import type { ProjectPaths } from "@shadowclone/core";
import { integrationFixture } from "@shadowclone/core/testing";
import { recordFingerprint } from "./records";
import { writeEnvironment } from "./store";
import { emptyEnvironment, learningRuleSchema, type LearningRecord } from "./types";

export function learningRecord(
  options: { readonly key?: string; readonly body?: string } = {},
): LearningRecord {
  return {
    kind: "guidance",
    sourceHash: null,
    sourceLocator: null,
    rule: learningRuleSchema.parse({
      key: options.key ?? "palette-validation",
      title: "Validate sample palette entries",
      body:
        options.body ??
        "Reject duplicate colors before writing the sample palette.",
      scope: "global",
      originDirectory: null,
      repositoryName: null,
      section: "workflow",
      source: "user",
      status: "active",
      proposal: null,
      appliesWhen: [],
      evidence: { for: [], against: [] },
      observations: 1,
      sessions: 1,
      lastSeen: "2026-01-01",
      origins: [],
      importReference: null,
    }),
  };
}

export async function writeActiveEnvironment(options: {
  readonly paths: ProjectPaths;
  readonly home: string;
  readonly bodies: readonly string[];
}): Promise<readonly LearningRecord[]> {
  const records = options.bodies.map((body, index) =>
    learningRecord({ key: `published-${index + 1}`, body }),
  );
  const artifact = {
    filePath: path.join(options.home, ".agents/skills/shadowclone-baseline/SKILL.md"),
    fingerprint: "synthetic",
    original: null,
    kind: "skill" as const,
    scope: "global",
    name: "shadowclone-baseline",
    description: "Always load",
    learningKeys: records.map((record) => record.rule.key),
  };

  await writeEnvironment({
    paths: options.paths,
    state: {
      ...emptyEnvironment,
      phase: "active",
      baselineDirectory: options.home,
      artifacts: [artifact],
      records: [...records],
      dispositions: records.map((record) => ({
        scope: "global",
        key: record.rule.key,
        inputFingerprint: recordFingerprint(record),
        status: "published" as const,
        reason: "Published",
        destinations: [artifact.filePath],
      })),
    },
  });

  return records;
}

export async function environmentFixture() {
  const setup = await integrationFixture();

  await writeEnvironment({
    paths: setup.paths,
    state: { ...emptyEnvironment, phase: "active", baselineDirectory: setup.home },
  });

  return setup;
}
