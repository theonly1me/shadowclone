export const defaultTaskCount = 5;
export const defaultRepeat = 2;
export const defaultTimeoutSeconds = 600;

const callsPerRun = 12;

export function invocationCeiling(options: {
  readonly tasks?: number;
  readonly repeat?: number;
}): number {
  const tasks = options.tasks ?? defaultTaskCount;
  const repeat = options.repeat ?? defaultRepeat;

  return tasks * (repeat * callsPerRun + callsPerRun);
}
