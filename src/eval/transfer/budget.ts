export const defaultTaskCount = 3;
export const defaultRepeat = 2;
export const defaultTimeoutSeconds = 1200;

const preparationCalls = 3;
const executionCallsPerTask = 3 + 9 * maximumJudgeAttempts *
  (1 + Math.ceil(codingCriteria.length / maximumJudgeBatchSize));

export function preparationCandidateLimit(tasks: number): number {
  return tasks > 0 ? preparationCalls : 0;
}

export function invocationCeiling(options: {
  readonly tasks?: number;
  readonly repeat?: number;
}): number {
  const tasks = options.tasks ?? defaultTaskCount;
  const repeat = options.repeat ?? defaultRepeat;

  return (
    preparationCandidateLimit(tasks) +
    tasks * repeat * executionCallsPerTask
  );
}
import { codingCriteria } from "./codeRubric";
import { maximumJudgeAttempts, maximumJudgeBatchSize } from "./judgeWork";
