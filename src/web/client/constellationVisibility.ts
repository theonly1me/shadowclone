import type { Constellation } from "../../builds/constellationSchema";

export function revealMatchingBranches(options: {
  readonly constellation: Constellation;
  readonly matchingItemIds: ReadonlySet<string>;
  readonly expandedHubIds: Set<string>;
}): void {
  const parents = new Map(options.constellation.hubs.map((hub) => [hub.id, hub.parentId]));
  for (const leaf of options.constellation.leaves) {
    if (!leaf.itemIds.some((id) => options.matchingItemIds.has(id))) continue;
    let parent: string | null = leaf.parentId;
    while (parent) {
      options.expandedHubIds.add(parent);
      parent = parents.get(parent) ?? null;
    }
  }
}

export function visibleConstellation(options: {
  readonly constellation: Constellation;
  readonly expandedHubIds: ReadonlySet<string>;
}): Constellation {
  const visibleHubIds = new Set<string>();
  const parents = new Map(options.constellation.hubs.map((hub) => [hub.id, hub.parentId]));
  const hubs = options.constellation.hubs.filter((hub) => {
    let parent = hub.parentId;
    while (parent) {
      if (!options.expandedHubIds.has(parent)) return false;
      parent = parents.get(parent) ?? null;
    }
    visibleHubIds.add(hub.id);
    return true;
  });
  return { hubs, leaves: options.constellation.leaves.filter((leaf) =>
    visibleHubIds.has(leaf.parentId) && options.expandedHubIds.has(leaf.parentId)) };
}

export function constellationBranchCounts(constellation: Constellation): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const parents = new Map(constellation.hubs.map((hub) => [hub.id, hub.parentId]));
  for (const leaf of constellation.leaves) {
    let parent: string | null = leaf.parentId;
    while (parent) {
      counts.set(parent, (counts.get(parent) ?? 0) + 1);
      parent = parents.get(parent) ?? null;
    }
  }
  return counts;
}

export function constellationFit(options: {
  readonly nodes: readonly { readonly x: number; readonly y: number }[];
  readonly width: number;
  readonly height: number;
}): { readonly x: number; readonly y: number; readonly scale: number } {
  const left = Math.min(...options.nodes.map((node) => node.x)) - 100;
  const right = Math.max(...options.nodes.map((node) => node.x)) + 100;
  const top = Math.min(...options.nodes.map((node) => node.y)) - 56;
  const bottom = Math.max(...options.nodes.map((node) => node.y)) + 76;
  const scale = Math.min(1, (options.width - 40) / (right - left), (options.height - 80) / (bottom - top));
  return { scale, x: options.width / 2 - scale * (left + right) / 2,
    y: options.height / 2 - scale * (top + bottom) / 2 };
}
