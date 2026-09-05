import type { IndexedEvent } from "../index";
import { textRefKey } from "../observe";
import type { CorrectionSignal } from "../signal";

const eligibleKinds = new Set<IndexedEvent["kind"]>([
  "user-prompt",
  "plan-presented",
  "plan-resolved",
  "question-asked",
  "question-answered",
  "permission-denied",
  "interruption",
]);

export function isEligibleForDistillation(event: IndexedEvent): boolean {
  return eligibleKinds.has(event.kind) && event.textRef !== null;
}

export function allowlistedSignals(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly events: readonly IndexedEvent[];
}): readonly CorrectionSignal[] {
  const independentlyEligibleReferences = new Set(
    options.events.flatMap((event) =>
      isEligibleForDistillation(event) && event.textRef
        ? [textRefKey(event.textRef)]
        : [],
    ),
  );
  const assistantReferences = new Set(
    options.events.flatMap((event) =>
      event.kind === "assistant-text" && event.textRef
        ? [textRefKey(event.textRef)]
        : [],
    ),
  );
  return options.signals.map((signal) => ({
    ...signal,
    textRefs: signal.textRefs.filter((ref) => {
      const key = textRefKey(ref);
      return (
        independentlyEligibleReferences.has(key) ||
        assistantReferences.has(key)
      );
    }),
  }));
}
