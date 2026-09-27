import { expect, test } from "bun:test";
import { indexSelectionCorpus, rankSelectionRecord } from "./selectionRank";
import { selectTaskGuidance } from "./selector";
import {
  frozenSelectionCorpus,
  type GuidanceSelectionItem,
} from "./selectionCorpus";
import { renderReference } from "../../../references/format";

function record(
  options: Partial<GuidanceSelectionItem> & { readonly id: string },
): GuidanceSelectionItem {
  return {
    kind: "profile",
    title: "",
    applicability: [],
    tags: [],
    summary: "",
    body: "",
    block: "",
    excluded: null,
    ...options,
  };
}

test("rarity uses document frequency, the fixed twenty-percent threshold, and exact term boundaries", () => {
  const corpus = Array.from({ length: 20 }, (_, index) =>
    record({
      id: `entry-${index}`,
      title: index < 4 ? "rare common" : "common",
      body: index === 0 ? "uncommon detail" : "other",
    }),
  );

  const index = indexSelectionCorpus(corpus);
  const first = index.records[0];

  if (!first) {
    throw new Error("Missing synthetic record");
  }

  expect(index.maximumAnchorFrequency).toBe(4);
  expect(index.frequencies.get("common")).toBe(20);
  expect(
    rankSelectionRecord({
      record: first,
      index,
      tokens: ["rare", "common", "comm"],
    }).anchorTerms,
  ).toEqual(["rare"]);
  expect(
    rankSelectionRecord({
      record: first,
      index,
      tokens: ["rare", "common", "comm"],
    }).matchingTerms,
  ).toEqual(["rare", "common"]);
  expect(indexSelectionCorpus(corpus.slice(0, 3)).maximumAnchorFrequency).toBe(
    2,
  );
});

test("IDF scoring counts each term once at its highest matching field weight", () => {
  const index = indexSelectionCorpus([
    record({
      id: "first",
      title: "alpha alpha",
      tags: ["alpha"],
      applicability: ["alpha"],
      summary: "alpha",
      body: "alpha alpha beta",
    }),
    record({ id: "second", title: "gamma" }),
    record({ id: "third", title: "delta" }),
  ]);

  const first = index.records[0];

  if (!first) {
    throw new Error("Missing synthetic record");
  }

  const result = rankSelectionRecord({
    record: first,
    index,
    tokens: ["alpha", "beta"],
  });

  expect(result.score).toBeCloseTo(5 * (1 + Math.log(4 / 2)), 12);
  expect(result.anchorTerms).toEqual(["alpha"]);
});

test("body-only rare matches cannot rescue a common metadata anchor", () => {
  const corpus = Array.from({ length: 6 }, (_, index) =>
    record({
      id: `entry-${index}`,
      title: "routine change",
      body: index === 0 ? "specific detail" : "general detail",
      block: "Routine change",
    }),
  );

  const result = selectTaskGuidance({ taskText: "routine specific", corpus });

  expect(result.packet).toBe("");
  expect(result.omissions.find((entry) => entry.id === "entry-0")?.reason).toBe(
    "no-specific-anchor",
  );
});

test("repository identity and scope are not indexed as applicability anchors", () => {
  const content = renderReference({
    schema: 1,
    key: "locking",
    title: "Locking",
    summary: "Avoid deadlocks.",
    body: "Maintain atomic transactions.",
    tags: [],
    scope: "project",
    originDirectory: "organization",
    repositoryName: "projectname",
    source: "user",
    sourceLocator: "fixtures/locking",
    updatedAt: "2026-09-21",
  });

  const corpus = frozenSelectionCorpus({
    profile: "# Profile",
    skills: [],
    references: [{ relativePath: "references/locking.md", content }],
  });

  expect(corpus[0]?.applicability).toEqual([]);
  expect(
    selectTaskGuidance({ taskText: "projectname atomic transactions", corpus })
      .packet,
  ).toBe("");
});
