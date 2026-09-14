import { AsyncLocalStorage } from "node:async_hooks";

const deadlineSignals = new AsyncLocalStorage<{
  readonly signal: AbortSignal;
  readonly finalizers: Set<() => Promise<void>>;
}>();

export const initialEvaluationDeadlineMs = 7 * 60 * 1000;

export function evaluationSignal(): AbortSignal | undefined {
  return deadlineSignals.getStore()?.signal;
}

export function onEvaluationDeadline(finalize: () => Promise<void>): () => void {
  const context = deadlineSignals.getStore();
  context?.finalizers.add(finalize);
  return () => { context?.finalizers.delete(finalize); };
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
  const finalizers = new Set<() => Promise<void>>();
  const durationMs = options.durationMs ?? initialEvaluationDeadlineMs;
  const cleanupAllowanceMs = Math.min(5_000, Math.floor(durationMs / 4));
  const abortTimeout = setTimeout(
    () => controller.abort(evaluationDeadlineError()),
    durationMs - cleanupAllowanceMs,
  );
  let hardTimeout: ReturnType<typeof setTimeout> | undefined;
  const hardLimit = new Promise<never>((_, reject) => {
    hardTimeout = setTimeout(
      () => {
        Promise.all([...finalizers].map((finalize) => finalize()))
          .then(() => reject(evaluationDeadlineError()))
          .catch(reject);
      },
      durationMs,
    );
  });
  const disable = (): void => {
    clearTimeout(abortTimeout);
    clearTimeout(hardTimeout);
  };
  try {
    const operation = deadlineSignals.run(
      { signal: controller.signal, finalizers },
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
