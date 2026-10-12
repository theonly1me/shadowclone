import { fingerprint, type ProjectPaths } from "@shadowclone/core";
import type { LearningExecution } from "@shadowclone/agents";
import type { ProfileRejectionReason } from "@shadowclone/profile";
import { readEnvironment, renderEnvironment } from "@shadowclone/environment";
import { applyPreferencePreview, retiredRecord } from "./lifecycle";

export async function isLearningPublished(options: {
  readonly paths: ProjectPaths;
  readonly key: string;
}): Promise<boolean> {
  const state = await readEnvironment(options.paths);

  return state?.dispositions.some((entry) => entry.key === options.key && entry.status === "published") ?? false;
}

export async function discardLearnings(options: {
  readonly paths: ProjectPaths;
  readonly keys: readonly string[];
  readonly reason: ProfileRejectionReason;
  readonly execution?: LearningExecution;
}): Promise<string | null> {
  const state = await readEnvironment(options.paths);
  const records = state?.records.filter(({ rule }) => options.keys.includes(rule.key)) ?? [];

  if (!state || records.length !== new Set(options.keys).size) {
    throw new Error("Learning record was not found");
  }

  const result = await applyPreferencePreview({
    paths: options.paths,
    execution: options.execution,
    preview: {
      fingerprint: fingerprint(renderEnvironment(state)),
      changes: records.map((record) => ({ before: record, after: retiredRecord(record) })),
      rejectionReason: options.reason,
    },
  });

  return result.revision;
}
