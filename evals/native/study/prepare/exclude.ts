import {
  belongsToScope,
  learningScopes,
  readEnvironment,
  readRedactedEnvironment,
  recordFingerprint,
  reviewLearning,
} from "@shadowclone/environment";
import type { ProjectPaths } from "@shadowclone/core";

const reason = "Left unpublished by the study's resolution rule because it conflicts with another source or the evaluation policy.";

export async function excludeUnresolved(paths: ProjectPaths): Promise<{ readonly excluded: readonly string[] }> {
  const state = await readEnvironment(paths);
  const redacted = await readRedactedEnvironment(paths);

  if (state === null || redacted === null) {
    throw new Error("Prepare the environment before excluding its unresolved learnings");
  }

  const scopes = learningScopes({ paths, state });
  const blockers = redacted.records.filter((record) => record.rule.status === "active" && record.rule.source !== "imported" &&
    scopes.some((scope) => belongsToScope({ record, scope }) && !state.dispositions.some((entry) =>
      entry.key === record.rule.key && entry.scope === scope.key && entry.inputFingerprint === recordFingerprint(record) && entry.status !== "pending")));

  for (const record of blockers) {
    await reviewLearning({ paths, key: record.rule.key, action: "exclude", reason });
  }

  return { excluded: blockers.map((record) => record.rule.key) };
}
