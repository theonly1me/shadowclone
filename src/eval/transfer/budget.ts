export const defaultTaskCount = 3;
export const defaultRepeat = 2;
export const defaultTimeoutSeconds = 1200;

const preparationCalls = 3;
const executionCallsPerTask = 14;

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
