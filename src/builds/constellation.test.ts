import { describe, expect, test } from "bun:test";
import { buildConstellation } from "./constellation";
import { constellationIdentity } from "./constellationIdentity";
import type { BuildItem } from "./types";

function item(options: {
  readonly id: string;
  readonly category?: string | null;
  readonly text?: string;
  readonly name?: string;
}): BuildItem {
  const name = options.name ?? options.id;

  return {
    id: options.id,
    name,
    title: name.replaceAll("-", " "),
    description: `Guidance for ${name}`,
    text: options.text ?? `Instructions for ${options.id}`,
    kind: "skill",
    category: options.category ?? null,
    section: "workflow",
    axis: null,
    owner: "packaged",
  };
}

describe("buildConstellation", () => {
  test("builds a stable constellation for one item", () => {
    const first = buildConstellation([item({ id: "review-carefully" })]);
    const second = buildConstellation([item({ id: "review-carefully" })]);

    expect(first).toEqual(second);
    expect(first.hubs).toHaveLength(1);
    expect(first.leaves[0]?.itemIds).toEqual(["review-carefully"]);
  });

  test("keeps top-level hubs bounded and nests large groups", () => {
    const items = Array.from({ length: 100 }, (_, index) =>
      item({ id: `skill-${index}`, category: `topic-${index % 10}` }),
    );
    const result = buildConstellation(items);
    const topLevel = result.hubs.filter((hub) => hub.parentId === null);

    expect(topLevel.length).toBeGreaterThanOrEqual(4);
    expect(topLevel.length).toBeLessThanOrEqual(12);
    expect(result.leaves).toHaveLength(100);
    expect(
      result.hubs.filter((hub) => hub.parentId !== null).length,
    ).toBe(0);
  });

  test("nests groups larger than ten items", () => {
    const result = buildConstellation(
      Array.from({ length: 21 }, (_, index) =>
        item({ id: `review-${index}`, category: "review" }),
      ),
    );

    expect(result.hubs.filter((hub) => hub.parentId !== null)).toHaveLength(3);
    expect(
      Math.max(
        ...result.hubs
          .filter((hub) => hub.parentId !== null)
          .map(
            (hub) =>
              result.leaves.filter((leaf) => leaf.parentId === hub.id).length,
          ),
      ),
    ).toBeLessThanOrEqual(10);
  });

  test("collapses exact content and keeps divergent namesakes", () => {
    const result = buildConstellation([
      item({ id: "first", name: "review", text: "same" }),
      item({ id: "copy", name: "review-copy", text: "same" }),
      item({ id: "variant", name: "review", text: "different" }),
    ]);

    expect(result.leaves).toHaveLength(2);
    expect(result.leaves.find((leaf) => leaf.itemIds.length === 2)?.itemIds).toEqual([
      "copy",
      "first",
    ]);
  });

  test("derives identity from equipped hubs", () => {
    const constellation = buildConstellation([
      item({ id: "review-one", category: "review" }),
      item({ id: "review-two", category: "review" }),
      item({ id: "testing-one", category: "testing" }),
    ]);
    const identity = constellationIdentity({
      constellation,
      selectedItemIds: new Set(["review-one", "review-two"]),
    });

    expect(identity?.title).toBe("The Review Pathfinder");
    expect(identity?.traits).toEqual([{ title: "Review", count: 2 }]);
  });
});
