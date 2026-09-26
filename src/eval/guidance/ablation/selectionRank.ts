import { normalized } from "../../../references/search";
import type { GuidanceSelectionItem } from "./selectionCorpus";

export const selectionRanking = { anchorFrequencyFraction: 0.2, minimumAnchorFrequency: 2,
  weights: { title: 4, tags: 4, applicability: 3, summary: 2, body: 1 } } as const;

function terms(value: string): ReadonlySet<string> {
  return new Set(normalized(value).split(" ").filter(Boolean));
}

export function indexSelectionCorpus(corpus: readonly GuidanceSelectionItem[]) {
  const records = corpus.map(item => {
    const fields = { title: terms(item.title), tags: terms(item.tags.join(" ")), applicability: terms(item.applicability.join(" ")), summary: terms(item.summary), body: terms(item.body) };
    return { item, fields, terms: new Set(Object.values(fields).flatMap(field => [...field])), anchors: new Set([...fields.title, ...fields.tags, ...fields.applicability]) };
  });
  const frequencies = new Map<string, number>();
  for (const record of records) for (const term of record.terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  const maximumAnchorFrequency = Math.max(selectionRanking.minimumAnchorFrequency, Math.floor(selectionRanking.anchorFrequencyFraction * records.length));
  return { records, frequencies, maximumAnchorFrequency };
}

export function rankSelectionRecord(options: {
  readonly record: ReturnType<typeof indexSelectionCorpus>["records"][number];
  readonly index: ReturnType<typeof indexSelectionCorpus>;
  readonly tokens: readonly string[];
}) {
  const matchingTerms = options.tokens.filter(term => options.record.terms.has(term));
  const anchorTerms = matchingTerms.filter(term => options.record.anchors.has(term) && (options.index.frequencies.get(term) ?? 0) <= options.index.maximumAnchorFrequency);
  const score = matchingTerms.reduce((total, term) => {
    const weight = Math.max(...Object.entries(selectionRanking.weights).map(([field, weight]) => {
      const terms = Object.entries(options.record.fields).find(([name]) => name === field)?.[1];
      return terms?.has(term) ? weight : 0;
    }));
    const frequency = options.index.frequencies.get(term) ?? 0;
    return total + weight * (1 + Math.log((options.index.records.length + 1) / (frequency + 1)));
  }, 0);
  return { matchingTerms, anchorTerms, score };
}
