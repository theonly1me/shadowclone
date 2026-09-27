import { recordFingerprint } from "./records";
import type { LearningScope } from "./scope";
import type { EnvironmentState, LearningRecord } from "./types";

export function pendingLearningState(options: {
  readonly state: EnvironmentState;
  readonly records: readonly LearningRecord[];
  readonly keys: ReadonlySet<string>;
  readonly scope: LearningScope;
  readonly reason: string;
  readonly destinations: string[];
}): EnvironmentState {
  const { state, records, keys } = options;

  return {
    ...state,
    dispositions: [
      ...state.dispositions.filter(
        (entry) => !keys.has(entry.key) || entry.scope !== options.scope.key,
      ),
      ...records.map((record) => ({
        key: record.rule.key,
        scope: options.scope.key,
        inputFingerprint: recordFingerprint(record),
        status: "pending" as const,
        reason: options.reason,
        destinations: [...options.destinations],
      })),
    ],
  };
}

export function coveredLearningState(options: {
  readonly state: EnvironmentState;
  readonly records: readonly LearningRecord[];
  readonly keys: ReadonlySet<string>;
  readonly scope: LearningScope;
  readonly target: string;
  readonly fingerprint: string;
}): EnvironmentState {
  const { state, records, keys } = options;

  return {
    ...state,
    dispositions: [
      ...state.dispositions.filter(
        (entry) => !keys.has(entry.key) || entry.scope !== options.scope.key,
      ),
      ...records.map((record) => ({
        key: record.rule.key,
        scope: options.scope.key,
        inputFingerprint: recordFingerprint(record),
        status: "covered" as const,
        reason:
          "The complete learning is already present in the existing skill",
        destinations: [options.target],
        fingerprints: { [options.target]: options.fingerprint },
      })),
    ],
  };
}
