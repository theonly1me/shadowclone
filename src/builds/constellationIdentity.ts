import type { Constellation } from "./constellationSchema";

export type ConstellationIdentity = {
  readonly title: string;
  readonly traits: readonly { readonly title: string; readonly count: number }[];
};

export function constellationIdentity(options: {
  readonly constellation: Constellation;
  readonly selectedItemIds: ReadonlySet<string>;
}): ConstellationIdentity | null {
  const hubs = new Map(options.constellation.hubs.map((hub) => [hub.id, hub]));
  const counts = new Map<string, number>();

  for (const leaf of options.constellation.leaves) {
    if (!leaf.itemIds.some((id) => options.selectedItemIds.has(id))) continue;

    let hub = hubs.get(leaf.parentId);

    while (hub?.parentId) hub = hubs.get(hub.parentId);

    if (hub) counts.set(hub.id, (counts.get(hub.id) ?? 0) + 1);
  }

  const traits = [...counts]
    .map(([id, count]) => ({ title: hubs.get(id)?.title ?? "Guidance", count }))
    .sort(
      (left, right) => right.count - left.count || left.title.localeCompare(right.title),
    );
  const primary = traits[0];

  return primary
    ? { title: `The ${primary.title} Pathfinder`, traits: traits.slice(0, 4) }
    : null;
}
