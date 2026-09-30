import { expect, test } from "bun:test";
import { buildConstellation } from "../../builds/constellation";
import { constellationItems } from "./constellationFixtures";
import { constellationBranchCounts, revealMatchingBranches, visibleConstellation } from "./constellationVisibility";

test("a 500-skill category opens in readable groups and preserves every leaf", () => {
  const constellation = buildConstellation(constellationItems({ count: 500, singleCategory: true }));
  const expandedHubIds = new Set<string>();
  const overview = visibleConstellation({ constellation, expandedHubIds });
  expect(overview.hubs).toHaveLength(1);
  expect(overview.leaves).toHaveLength(0);
  const parent = overview.hubs[0];
  if (!parent) throw new Error("Expected a category");
  expect(constellationBranchCounts(constellation).get(parent.id)).toBe(500);
  expandedHubIds.add(parent.id);
  const categories = visibleConstellation({ constellation, expandedHubIds });
  expect(categories.hubs).toHaveLength(6);
  expect(categories.leaves).toHaveLength(0);
  const child = categories.hubs.find((hub) => hub.parentId === parent.id);
  if (!child) throw new Error("Expected a skill group");
  expandedHubIds.add(child.id);
  const groups = visibleConstellation({ constellation, expandedHubIds });
  expect(groups.leaves).toHaveLength(0);
  const group = groups.hubs.find((hub) => hub.parentId === child.id);
  if (!group) throw new Error("Expected a nested skill group");
  expandedHubIds.add(group.id);
  expect(visibleConstellation({ constellation, expandedHubIds }).leaves).toHaveLength(10);
  for (const hub of constellation.hubs) expandedHubIds.add(hub.id);
  expect(visibleConstellation({ constellation, expandedHubIds }).leaves).toEqual(constellation.leaves);
  expandedHubIds.delete(parent.id);
  expect(visibleConstellation({ constellation, expandedHubIds }).leaves).toHaveLength(0);
});

test("search reveals a matching skill through collapsed ancestors regardless of hub order", () => {
  const original = buildConstellation(constellationItems({ count: 500 }));
  const constellation = { ...original, hubs: [...original.hubs].reverse() };
  const expandedHubIds = new Set<string>();
  revealMatchingBranches({ constellation, matchingItemIds: new Set(["skill-499"]), expandedHubIds });
  const shown = visibleConstellation({ constellation, expandedHubIds });
  expect(shown.leaves.some((leaf) => leaf.itemIds.includes("skill-499"))).toBeTrue();
  expect(shown.leaves.length).toBeLessThanOrEqual(10);
});
