import type { BuildItem } from "./types";
import { constellationSchema, type Constellation } from "./constellationSchema";

const ignoredWords = new Set([
  "agent", "before", "change", "changing", "code", "existing", "from",
  "into", "skill", "that", "the", "this", "when", "with", "work",
]);
type Entry = {
  readonly itemIds: readonly string[];
  readonly item: BuildItem;
  readonly topics: readonly string[];
};
type Bucket = { key: string; entries: Entry[] };
function words(text: string): readonly string[] {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, " ")
    .split(/[\s-]+/)
    .filter((word) => word.length > 2 && !ignoredWords.has(word));
}
function topics(item: BuildItem): readonly string[] {
  return [
    item.category,
    item.section,
    item.axis,
    ...words(item.name),
    ...words(item.title),
    ...words(item.description),
  ].filter((topic, index, all): topic is string =>
    Boolean(topic && all.indexOf(topic) === index),
  );
}
function title(key: string): string {
  return key
    .split("-")
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function uniqueEntries(items: readonly BuildItem[]): readonly Entry[] {
  const byContent = new Map<string, { item: BuildItem; ids: string[] }>();

  for (const item of [...items].sort((left, right) => left.id.localeCompare(right.id))) {
    const fingerprint = `${item.kind}\u0000${item.text.trim()}`;
    const existing = byContent.get(fingerprint);

    if (existing) {
      existing.ids.push(item.id);
    } else {
      byContent.set(fingerprint, { item, ids: [item.id] });
    }
  }

  return [...byContent.values()].map(({ item, ids }) => ({
    item,
    itemIds: ids,
    topics: topics(item),
  }));
}

function desiredHubCount(itemCount: number): number {
  if (itemCount < 4) return Math.max(1, itemCount);

  return Math.min(12, Math.max(4, Math.round(Math.sqrt(itemCount))));
}

function groupEntries(entries: readonly Entry[]): readonly Bucket[] {
  const grouped = Map.groupBy(entries, (entry) => entry.topics[0] ?? "guidance");
  const buckets = [...grouped].map(([key, groupedEntries]) => ({
    key,
    entries: groupedEntries,
  }));
  const desired = desiredHubCount(entries.length);

  buckets.sort(
    (left, right) =>
      right.entries.length - left.entries.length || left.key.localeCompare(right.key),
  );

  const retained = buckets.slice(0, desired);

  for (const bucket of buckets.slice(desired)) {
    for (const entry of bucket.entries) {
      const matching = retained
        .map((candidate) => ({
          candidate,
          score:
            (entry.item.section === candidate.entries[0]?.item.section
              ? 4
              : 0) + (entry.topics.includes(candidate.key) ? 1 : 0),
        }))
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.candidate.entries.length - right.candidate.entries.length ||
            left.candidate.key.localeCompare(right.candidate.key),
        )[0];

      matching?.candidate.entries.push(entry);
    }
  }

  return retained.sort((left, right) => left.key.localeCompare(right.key));
}

function bucketLabel(bucket: Bucket): string {
  const categories = new Set(
    bucket.entries.flatMap((entry) =>
      entry.item.category ? [entry.item.category] : [],
    ),
  );

  if (categories.size === 1) return [...categories][0] ?? bucket.key;

  const sections = new Set(
    bucket.entries.flatMap((entry) =>
      entry.item.section ? [entry.item.section] : [],
    ),
  );

  return sections.size === 1 ? ([...sections][0] ?? bucket.key) : bucket.key;
}

function preferredSubtopic(entries: readonly Entry[], parent: string): string {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const topic of entry.topics.filter((candidate) => candidate !== parent)) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  return [...counts].sort(
    ([left, leftCount], [right, rightCount]) =>
      rightCount - leftCount || left.localeCompare(right),
  )[0]?.[0] ?? parent;
}

export function buildConstellation(items: readonly BuildItem[]): Constellation {
  const entries = uniqueEntries(items);
  const buckets = groupEntries(entries);
  const labels = buckets.map(bucketLabel);
  const hubs: Constellation["hubs"][number][] = [];
  const leaves: Constellation["leaves"][number][] = [];

  for (const [bucketIndex, bucket] of buckets.entries()) {
    const hubId = `hub:${bucketIndex}:${bucket.key}`;
    const label = labels[bucketIndex] ?? bucket.key;
    const duplicateIndex = labels.slice(0, bucketIndex).filter(
      (candidate) => candidate === label,
    ).length;
    const duplicateCount = labels.filter((candidate) => candidate === label).length;
    hubs.push({
      id: hubId,
      title: `${title(label)}${duplicateCount > 1 ? ` ${duplicateIndex + 1}` : ""}`,
      parentId: null,
    });
    const ordered = [...bucket.entries].sort((left, right) =>
      left.item.id.localeCompare(right.item.id),
    );
    const chunks = Array.from(
      { length: Math.ceil(ordered.length / 10) },
      (_, index) => ordered.slice(index * 10, index * 10 + 10),
    );

    for (const [chunkIndex, chunk] of chunks.entries()) {
      const parentId = chunks.length === 1 ? hubId : `${hubId}:${chunkIndex}`;

      if (chunks.length > 1) {
        const subtopic = preferredSubtopic(chunk, bucket.key);
        hubs.push({
          id: parentId,
          title: `${title(subtopic)} ${chunkIndex + 1}`,
          parentId: hubId,
        });
      }

      for (const entry of chunk) {
        const relatedHubIds = buckets
          .map((candidate, index) => ({ candidate, index }))
          .filter(
            ({ candidate }) =>
              candidate.key !== bucket.key && entry.topics.includes(candidate.key),
          )
          .slice(0, 2)
          .map(({ candidate, index }) => `hub:${index}:${candidate.key}`);

        leaves.push({
          id: `skill:${entry.item.id}`,
          itemIds: [...entry.itemIds],
          parentId,
          relatedHubIds,
        });
      }
    }
  }

  return constellationSchema.parse({ hubs, leaves });
}
