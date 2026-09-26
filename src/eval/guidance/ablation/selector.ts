import { normalized } from "../../../references/search";
import type { GuidanceSelectionItem } from "./selectionCorpus";
import { indexSelectionCorpus, rankSelectionRecord, selectionRanking } from "./selectionRank";

export const selectionVersion = "task-selected-guidance-v2";
export const selectionLimits = { maximumItems: 4, maximumBytes: 4096, maximumLines: 200, minimumMatchingTerms: 2 } as const;
const stopwords = new Set("a an and are as at be been being both but by can could did do does doing each for from had has have how i if in into is it its may me might more most must my no not of on only or other our out same should so some than that the their them then there these they this those through to too under up use used using very was we were what when where which while who why will with would you your".split(" "));
type OmissionReason = "skill-routing" | "skill-covered" | "duplicate" | "insufficient-matches" | "no-specific-anchor" | "item-limit" | "byte-limit" | "line-limit";
type Omission = { id: string; reason: OmissionReason; matchingTerms: readonly string[] };

function fingerprint(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

function stableOrder(options: { readonly left: string; readonly right: string }): number {
  const { left, right } = options;
  return left < right ? -1 : left > right ? 1 : 0;
}

function lineCount(text: string): number {
  return text.length === 0 ? 0 : text.split("\n").length;
}

export function selectTaskGuidance(options: {
  readonly taskText: string;
  readonly corpus: readonly GuidanceSelectionItem[];
}) {
  const tokens = [...new Set(normalized(options.taskText).split(" ").filter(token => token.length > 1 && !stopwords.has(token)))].sort();
  const corpus = [...options.corpus].sort((left, right) => stableOrder({ left: left.id, right: right.id }));
  const index = indexSelectionCorpus(corpus);
  const identifiers = new Set<string>();
  const seenBodies = new Set<string>();
  const omissions: Omission[] = [];
  const ranked = index.records.flatMap(record => {
    const { item } = record;
    if (identifiers.has(item.id)) throw new Error("Frozen selection identifiers must be unique");
    identifiers.add(item.id);
    const { matchingTerms, anchorTerms, score } = rankSelectionRecord({ record, index, tokens });
    const body = normalized(item.body);
    const reason = item.excluded ?? (seenBodies.has(body) ? "duplicate" : matchingTerms.length < selectionLimits.minimumMatchingTerms ? "insufficient-matches" : anchorTerms.length === 0 ? "no-specific-anchor" : null);
    if (reason) { omissions.push({ id: item.id, reason, matchingTerms }); return []; }
    seenBodies.add(body);
    return [{ item, matchingTerms, anchorTerms, score }];
  }).sort((left, right) => right.score - left.score || stableOrder({ left: left.item.id, right: right.item.id }));
  const selectedIds: string[] = [];
  const blocks: string[] = [];
  for (const { item, matchingTerms } of ranked) {
    const candidate = [...blocks, item.block].join("\n\n");
    const reason = selectedIds.length >= selectionLimits.maximumItems ? "item-limit"
      : Buffer.byteLength(candidate) > selectionLimits.maximumBytes ? "byte-limit"
      : lineCount(candidate) > selectionLimits.maximumLines ? "line-limit" : null;
    if (reason) { omissions.push({ id: item.id, reason, matchingTerms }); continue; }
    selectedIds.push(item.id);
    blocks.push(item.block);
  }
  omissions.sort((left, right) => stableOrder({ left: left.id, right: right.id }));
  const packet = blocks.join("\n\n");
  const manifest = { version: selectionVersion, limits: selectionLimits, ranking: selectionRanking, stopwordsFingerprint: fingerprint([...stopwords].sort().join(" ")),
    corpusFingerprint: fingerprint(JSON.stringify(corpus)), taskFingerprint: fingerprint(options.taskText),
    packetFingerprint: fingerprint(packet), selectedIds, omissions, bytes: Buffer.byteLength(packet), lines: lineCount(packet) };
  return { ...manifest, packet, fingerprint: fingerprint(JSON.stringify(manifest)) };
}
