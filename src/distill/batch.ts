import { resolveRedacted } from "../redact";
import type {
  CorrectionSignal,
  OriginScope,
} from "../signal";

export type DistillBatch = {
  readonly origin: OriginScope;
  readonly signals: readonly CorrectionSignal[];
};

export function groupDistillBatches(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly batchSize?: number;
}): readonly DistillBatch[] {
  const batchSize = options.batchSize ?? 20;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Distillation batch size must be a positive integer");
  }

  const batches: DistillBatch[] = [];
  const grouped = Map.groupBy(options.signals, (signal) => signal.origin.id);
  for (const signals of grouped.values()) {
    const [first] = signals;
    if (!first) {
      continue;
    }
    for (let offset = 0; offset < signals.length; offset += batchSize) {
      batches.push({
        origin: first.origin,
        signals: signals.slice(offset, offset + batchSize),
      });
    }
  }
  return batches;
}

export async function buildDistillPrompt(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly maxExcerptCharacters?: number;
}): Promise<string> {
  const originIds = new Set(options.signals.map((signal) => signal.origin.id));
  if (originIds.size > 1) {
    throw new Error("A distillation request must contain one origin");
  }
  const maxExcerptCharacters = options.maxExcerptCharacters ?? 4_000;
  const moments: string[] = [];

  for (const signal of options.signals) {
    const excerpts: string[] = [];
    for (const ref of signal.textRefs) {
      const text = await resolveRedacted({ ref });
      if (text.length > 0) {
        excerpts.push(text.slice(0, maxExcerptCharacters));
      }
    }
    moments.push(
      [
        `Kind: ${signal.kind}`,
        `Pattern: ${signal.label}`,
        ...excerpts.map((excerpt) => `Excerpt:\n${excerpt}`),
      ].join("\n"),
    );
  }

  return [
    "Turn these correction moments into short, reusable engineering rules.",
    "Use only the evidence shown. Do not repeat secrets or private identifiers.",
    "Return JSON matching the supplied schema.",
    "",
    moments.join("\n\n"),
  ].join("\n");
}
