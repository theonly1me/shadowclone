import { AsyncLocalStorage } from "node:async_hooks";

const deadlineSignals = new AsyncLocalStorage<AbortSignal>();

export const initialEvaluationDeadlineMs = 7 * 60 * 1000;

export function evaluationSignal(): AbortSignal | undefined {
  return deadlineSignals.getStore();
}

export function evaluationDeadlineError(): Error {
  return new Error("Evaluation exceeded its wall-clock limit");
}

export function throwIfEvaluationExpired(): void {
  if (evaluationSignal()?.aborted) {
    throw evaluationDeadlineError();
  }
}

export async function withEvaluationDeadline<Result>(options: {
  readonly enabled: boolean;
  readonly operation: (control: { readonly disable: () => void }) => Promise<Result>;
  readonly durationMs?: number;
}): Promise<Result> {
  if (!options.enabled) {
    return options.operation({ disable: () => undefined });
  }

  const controller = new AbortController();
  const durationMs = options.durationMs ?? initialEvaluationDeadlineMs;
  const cleanupAllowanceMs = Math.min(5_000, Math.floor(durationMs / 4));
  const abortTimeout = setTimeout(
    () => controller.abort(evaluationDeadlineError()),
    durationMs - cleanupAllowanceMs,
  );
  let hardTimeout: ReturnType<typeof setTimeout> | undefined;
  const hardLimit = new Promise<never>((_, reject) => {
    hardTimeout = setTimeout(
      () => reject(evaluationDeadlineError()),
      durationMs,
    );
  });
  const disable = (): void => {
    clearTimeout(abortTimeout);
    clearTimeout(hardTimeout);
  };
  try {
    const operation = deadlineSignals.run(
      controller.signal,
      () => options.operation({ disable }),
    );
    const result = await Promise.race([operation, hardLimit]);
    if (controller.signal.aborted) {
      throw evaluationDeadlineError();
    }
    return result;
  } finally {
    disable();
  }
}
