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
  const data = graphData(options.constellation);
  const root = hierarchy(data, (node) => node.children.filter((child) => child.kind !== "skill"));

  tree<LayoutDatum>().nodeSize([210, 160])(root);

  let initialNodes = root.descendants().map((node) => ({
    id: node.data.id,
    title: node.data.title,
    itemIds: node.data.itemIds,
    relatedHubIds: node.data.relatedHubIds,
    kind: node.data.kind,
    parentId: node.parent?.data.id ?? null,
    x: coordinate(node.x) + options.width / 2,
    y: options.height - 92 - coordinate(node.y),
  }));
  if (options.constellation.leaves.length === 0 && root.height === 1) {
    const hubs = initialNodes.filter((node) => node.kind === "hub");
    const columns = Math.min(4, hubs.length);
    const rows = Math.ceil(hubs.length / columns);
    const indexes = new Map(hubs.map((hub, index) => [hub.id, index]));
    initialNodes = initialNodes.map((node) => {
      const index = indexes.get(node.id);
      return index === undefined ? node : { ...node,
        x: options.width / 2 + (index % columns - (columns - 1) / 2) * 210,
        y: options.height - 92 - (rows - Math.floor(index / columns)) * 160 };
    });
  }
  const nodes = [...initialNodes];
  for (const hub of root.descendants()) {
    const leaves = hub.data.children.filter((child) => child.kind === "skill");
    for (const [index, leaf] of leaves.entries()) {
      nodes.push({ ...leaf, parentId: hub.data.id, x: coordinate(hub.x) + options.width / 2,
        y: options.height - 92 - root.height * 160 - 88 * (index + 1) });
    }
  }
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
