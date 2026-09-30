import type { Constellation } from "./constellationSchema";

export function nestConstellationBranch(options: {
  readonly parentId: string;
  readonly title: string;
  readonly leaves: readonly Omit<Constellation["leaves"][number], "parentId">[];
}): Constellation {
  if (options.leaves.length <= 10) {
    return { hubs: [], leaves: options.leaves.map((leaf) => ({ ...leaf, parentId: options.parentId })) };
  }
  let groupSize = 10;
  while (options.leaves.length / groupSize > 10) groupSize *= 10;
  const hubs: Constellation["hubs"] = [];
  const leaves: Constellation["leaves"] = [];
  for (let offset = 0; offset < options.leaves.length; offset += groupSize) {
    const index = offset / groupSize;
    const id = `${options.parentId}:${index}`;
    const title = `${options.title} ${index + 1}`;
    hubs.push({ id, title, parentId: options.parentId });
    const nested = nestConstellationBranch({ parentId: id, title, leaves: options.leaves.slice(offset, offset + groupSize) });
    hubs.push(...nested.hubs);
    leaves.push(...nested.leaves);
  }
  return { hubs, leaves };
}
