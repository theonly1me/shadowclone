import { fingerprint } from "./structured";
import type { JudgeWork } from "./judgeTypes";
import type { PreferenceCheck } from "./types";

export const maximumJudgeBatchSize = 8;
export const maximumJudgeAttempts = 3;

export function preferenceIdentifier(check: PreferenceCheck): string {
  return check.rubric?.id ?? fingerprint(check.requirement).slice(0, 16);
}

export function judgeWork(options: {
  readonly taskPrompt: string;
  readonly correctness: readonly string[];
  readonly preferences: readonly PreferenceCheck[];
  readonly evidence: string;
}): readonly JudgeWork[] {
  const groups = [
    { kind: "correctness" as const, criteria: options.correctness.map((requirement) => fingerprint(requirement).slice(0, 16)) },
    { kind: "preferences" as const, criteria: options.preferences.map(preferenceIdentifier) },
  ];
  return [1, 2, 3].flatMap((vote) => groups.flatMap((group) => {
    const batches: JudgeWork[] = [];
    for (let offset = 0; offset < group.criteria.length; offset += maximumJudgeBatchSize) {
      const criteria = group.criteria.slice(offset, offset + maximumJudgeBatchSize);
      batches.push({
        id: fingerprint({ vote, kind: group.kind, criteria, requirements: group.kind === "preferences" ? options.preferences : options.correctness, taskPrompt: options.taskPrompt, evidence: options.evidence }),
        kind: group.kind,
        vote,
        criteria,
      });
    }
    return batches;
  }));
}
