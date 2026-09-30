import type { LearningExecution } from "../engine";
import { readLocalText } from "../localFiles";
import type { ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";
import { discoverDeliverySkills } from "../skillMaintenance/discover";
import type { MaintenanceState } from "../skillMaintenance/types";
import { nativePublication } from "./native";
import { reconcileLearningBatch } from "./reconcile";
import { recordFingerprint } from "./records";
import { publishEnvironmentRevision } from "./revision";
import { belongsToScope, type LearningScope } from "./scope";
import { readRedactedEnvironment, renderEnvironment } from "./store";
import type { EnvironmentState } from "./types";
import { retirementRequested } from "./draftSchema";

export async function updateLearningScope(options: {
  readonly paths: ProjectPaths;
  readonly execution: LearningExecution;
  readonly readRemote?: GitRemoteReader;
  readonly state: EnvironmentState;
  readonly scope: LearningScope;
  readonly maintenance: MaintenanceState;
  readonly filePath: string;
  readonly learningKeys?: readonly string[];
  readonly summary: {
    invalid: number;
    duplicates: number;
    assessed: number;
    applied: number;
  };
}): Promise<EnvironmentState> {
  const { scope, maintenance, filePath, summary } = options;
  let state = options.state;

  const roots = maintenance.roots.filter(
    (root) =>
      root.enabled &&
      (scope.repository === null
        ? root.scope === "global"
        : root.scope === "repository" && root.cwd === scope.directory),
  );

  let discovered = await discoverDeliverySkills(roots);

  summary.invalid += discovered.invalid;
  summary.duplicates += discovered.duplicates;

  const redacted = await readRedactedEnvironment(options.paths);

  if (redacted === null) {
    throw new Error("Learning environment cannot be resolved");
  }

  const eligible = redacted.records.filter(
    (record) =>
      (record.rule.status === "active" ||
        (retirementRequested(record) &&
          state.dispositions.some(
            (entry) =>
              entry.key === record.rule.key && entry.status === "published",
          ))) &&
      record.rule.proposal === null &&
      record.rule.source !== "imported" &&
      (options.learningKeys === undefined || options.learningKeys.includes(record.rule.key)) &&
      belongsToScope({ record, scope }) &&
      !state.dispositions.some(
        (entry) =>
          entry.key === record.rule.key &&
          entry.scope === scope.key &&
          entry.inputFingerprint === recordFingerprint(record),
      ),
  );

  for (
    let offset = 0;
    offset < eligible.length && options.execution.callsRemaining() > 1;
    offset += 8
  ) {
    discovered = await discoverDeliverySkills(roots);

    const records = eligible.slice(offset, offset + 8);

    const result = await reconcileLearningBatch({
      paths: options.paths,
      state,
      records,
      scope,
      skills: discovered.skills,
      execution: options.execution,
    });

    const native =
      result.state.phase === "active"
        ? await nativePublication({
            paths: options.paths,
            state: result.state,
            readRemote: options.readRemote,
          })
        : { state: result.state, updates: [] };

    await publishEnvironmentRevision({
      paths: options.paths,
      updates: [
        ...result.updates,
        ...native.updates,
        {
          filePath,
          previous: await readLocalText(filePath),
          next: renderEnvironment(native.state),
        },
      ],
    });
    state = native.state;
    summary.assessed += records.length;
    summary.applied += result.applied;
  }

  return state;
}
