import { expect, test } from "bun:test";
import { buildConstellation } from "../../builds/constellation";
import { constellationItems } from "./constellationFixtures";
import { layoutConstellation } from "./constellationLayout";
import { constellationFit, visibleConstellation } from "./constellationVisibility";

for (const count of [1, 20, 100, 500]) {
  for (const singleCategory of [false, true]) {
    test(`keeps ${count} ${singleCategory ? "single-category" : "distributed"} skills readable in a pannable world`, () => {
      const width = 960;
      const height = 720;
      const layout = layoutConstellation({
        constellation: buildConstellation(constellationItems({ count, singleCategory })),
        width,
        height,
      });

      expect(layout.nodes.filter((node) => node.kind === "skill")).toHaveLength(count);
      expect(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBeTrue();
      const overlaps: string[] = [];
      for (const [index, left] of layout.nodes.entries()) {
        for (const right of layout.nodes.slice(index + 1)) {
          if (Math.abs(left.x - right.x) < 200 && Math.abs(left.y - right.y) < 88) overlaps.push(`${left.id}:${right.id}`);
        }
      }
      expect(overlaps).toEqual([]);
      const fit = constellationFit({ nodes: layout.nodes, width, height });
      expect(layout.nodes.every((node) => node.x * fit.scale + fit.x >= 20 &&
        node.x * fit.scale + fit.x <= width - 20 && node.y * fit.scale + fit.y >= 40 &&
        node.y * fit.scale + fit.y <= height - 40)).toBeTrue();
    });
  }
}

test("large-library overview wraps category hubs into readable rows", () => {
  const constellation = visibleConstellation({
    constellation: buildConstellation(constellationItems({ count: 500 })), expandedHubIds: new Set(),
  });
  const layout = layoutConstellation({ constellation, width: 960, height: 720 });
  const hubs = layout.nodes.filter((node) => node.kind === "hub");
  expect(new Set(hubs.map((node) => node.y)).size).toBe(3);
  expect(new Set(hubs.map((node) => node.x)).size).toBeLessThanOrEqual(4);
  const fit = constellationFit({ nodes: layout.nodes, width: 960, height: 720 });
  expect(fit.scale).toBeGreaterThan(0.8);
});
