import { expect, test } from "bun:test";
import { buildConstellation } from "../../builds/constellation";
import type { BuildItem } from "../../builds/types";
import { layoutConstellation } from "./constellationLayout";

function items(count: number): readonly BuildItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `skill-${index}`,
    name: `skill-${index}`,
    title: `Skill ${index}`,
    description: `Synthetic behavior ${index}`,
    text: `Synthetic instructions ${index}`,
    kind: "skill",
    category: `topic-${index % Math.min(10, count)}`,
    section: "workflow",
    axis: null,
    owner: "packaged",
  }));
}

for (const count of [1, 20, 100, 500]) {
  test(`lays out ${count} items inside a bounded canvas`, () => {
    const width = 960;
    const height = 720;
    const layout = layoutConstellation({
      constellation: buildConstellation(items(count)),
      width,
      height,
    });

    expect(layout.nodes.length).toBeGreaterThan(count);
    expect(
      layout.nodes.every(
        (node) =>
          Number.isFinite(node.x) &&
          Number.isFinite(node.y) &&
          node.x >= 0 &&
          node.x <= width &&
          node.y >= 0 &&
          node.y <= height,
      ),
    ).toBeTrue();
  });
}
