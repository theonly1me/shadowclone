import { hierarchy, tree } from "d3-hierarchy";
import type { Constellation } from "../../builds/constellationSchema";

type LayoutDatum = {
  readonly id: string;
  readonly title: string;
  readonly itemIds: readonly string[];
  readonly relatedHubIds: readonly string[];
  readonly children: LayoutDatum[];
  readonly kind: "root" | "hub" | "skill";
};

export type PositionedConstellationNode = Omit<LayoutDatum, "children"> & {
  readonly parentId: string | null;
  readonly x: number;
  readonly y: number;
};

export type PositionedConstellationLink = {
  readonly id: string;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly related: boolean;
};

function coordinate(value: number | undefined): number {
  if (value === undefined) throw new Error("Constellation layout is incomplete");

  return value;
}

function graphData(constellation: Constellation): LayoutDatum {
  const hubs = new Map<string, LayoutDatum>();

  for (const hub of constellation.hubs) {
    hubs.set(hub.id, {
      id: hub.id,
      title: hub.title,
      itemIds: [],
      relatedHubIds: [],
      children: [],
      kind: "hub",
    });
  }

  const root: LayoutDatum = {
    id: "constellation-root",
    title: "Shadowclone",
    itemIds: [],
    relatedHubIds: [],
    children: [],
    kind: "root",
  };

  for (const hub of constellation.hubs) {
    const node = hubs.get(hub.id);
    const parent = hub.parentId ? hubs.get(hub.parentId) : root;

    if (node && parent) parent.children.push(node);
  }

  for (const leaf of constellation.leaves) {
    hubs.get(leaf.parentId)?.children.push({
      id: leaf.id,
      title: "",
      itemIds: leaf.itemIds,
      relatedHubIds: leaf.relatedHubIds,
      children: [],
      kind: "skill",
    });
  }

  const sortChildren = (node: LayoutDatum): void => {
    node.children.sort((left, right) => left.id.localeCompare(right.id));
    for (const child of node.children) sortChildren(child);
  };

  sortChildren(root);

  return root;
}

export function layoutConstellation(options: {
  readonly constellation: Constellation;
  readonly width: number;
  readonly height: number;
}): {
  readonly nodes: readonly PositionedConstellationNode[];
  readonly links: readonly PositionedConstellationLink[];
} {
  const root = hierarchy(graphData(options.constellation));
  const horizontal = Math.max(240, options.width - 96);
  const vertical = Math.max(320, options.height - 120);

  tree<LayoutDatum>().size([horizontal, vertical])(root);

  const initialNodes = root.descendants().map((node) => ({
    id: node.data.id,
    title: node.data.title,
    itemIds: node.data.itemIds,
    relatedHubIds: node.data.relatedHubIds,
    kind: node.data.kind,
    parentId: node.parent?.data.id ?? null,
    x: coordinate(node.x) + 48,
    y: options.height - 52 - coordinate(node.y),
  }));
  const initialById = new Map(initialNodes.map((node) => [node.id, node]));
  const siblingIndexes = new Map<string, number>();
  const siblingCounts = new Map<string, number>();

  for (const node of initialNodes.filter((entry) => entry.kind === "skill")) {
    if (node.parentId) {
      siblingCounts.set(
        node.parentId,
        (siblingCounts.get(node.parentId) ?? 0) + 1,
      );
    }
  }

  const nodes = initialNodes.map((node) => {
    const parent = node.parentId ? initialById.get(node.parentId) : undefined;

    if (node.kind !== "skill" || !parent || !node.parentId) return node;

    const index = siblingIndexes.get(node.parentId) ?? 0;
    const count = siblingCounts.get(node.parentId) ?? 1;
    const step = Math.max(14, (parent.y - 44) / (count + 1));
    siblingIndexes.set(node.parentId, index + 1);

    return {
      ...node,
      x: parent.x + (index % 2 === 0 ? -14 : 14),
      y: parent.y - step * (index + 1),
    };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links: PositionedConstellationLink[] = nodes.flatMap((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;

    return parent
      ? [{
          id: `${parent.id}:${node.id}`,
          sourceX: parent.x,
          sourceY: parent.y,
          targetX: node.x,
          targetY: node.y,
          related: false,
        }]
      : [];
  });

  for (const node of nodes.filter((entry) => entry.kind === "skill")) {
    for (const relatedHubId of node.relatedHubIds) {
      const target = byId.get(relatedHubId);

      if (target) {
        links.push({
          id: `${node.id}:${target.id}:related`,
          sourceX: node.x,
          sourceY: node.y,
          targetX: target.x,
          targetY: target.y,
          related: true,
        });
      }
    }
  }

  return { nodes, links };
}
