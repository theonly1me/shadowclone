import type { IndexedEvent } from "../index";
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

function referenceKey(ref: {
  readonly sourcePath: string;
  readonly byteOffset: number;
  readonly byteLength: number;
}): string {
  return `${ref.sourcePath}:${ref.byteOffset}:${ref.byteLength}`;
}

export function allowlistedSignals(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly events: readonly IndexedEvent[];
}): readonly CorrectionSignal[] {
  const independentlyEligibleReferences = new Set(
    options.events.flatMap((event) =>
      isEligibleForDistillation(event) && event.textRef
        ? [referenceKey(event.textRef)]
        : [],
    ),
  );
  const assistantReferences = new Set(
    options.events.flatMap((event) =>
      event.kind === "assistant-text" && event.textRef
        ? [referenceKey(event.textRef)]
        : [],
    ),
  );
  return options.signals.map((signal) => ({
    ...signal,
    textRefs: signal.textRefs.filter((ref) => {
      const key = referenceKey(ref);
      return (
        independentlyEligibleReferences.has(key) ||
        assistantReferences.has(key)
      );
    }),
  }));
}
