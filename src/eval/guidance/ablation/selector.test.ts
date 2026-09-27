import { expect, test } from "bun:test";
import { selectTaskGuidance } from "./selector";
import type { GuidanceSelectionItem } from "./selectionCorpus";

function item(
  options: Partial<GuidanceSelectionItem> & { readonly id: string },
): GuidanceSelectionItem {
  return {
    kind: "profile",
    title: "Database transaction boundaries",
    applicability: [],
    tags: [],
    summary: "",
    body: `Keep database transaction ${options.id} atomic.`,
    block: `## ${options.id}\n\nKeep database transaction ${options.id} atomic.`,
    excluded: null,
    ...options,
  };
}

function withBackground(
  corpus: readonly GuidanceSelectionItem[],
): readonly GuidanceSelectionItem[] {
  return [
    ...corpus,
    ...Array.from({ length: corpus.length * 4 }, (_, index) =>
      item({
        id: `astronomy/${index}`,
        title: "Galactic observations",
        body: `Nebula observation ${index}`,
        block: `Nebula observation ${index}`,
      }),
    ),
  ];
}

test("selection is deterministic with stable ties and no input mutation", () => {
  const corpus = [item({ id: "zeta" }), item({ id: "alpha" })];
  const before = JSON.stringify(corpus);
  const result = selectTaskGuidance({
    taskText: "Database transaction",
    corpus,
  });

  expect(result.selectedIds).toEqual(["alpha", "zeta"]);
  expect(
    selectTaskGuidance({
      taskText: "Database transaction",
      corpus: [...corpus].reverse(),
    }),
  ).toEqual(result);
  expect(JSON.stringify(corpus)).toBe(before);
  expect(result.version).toBe("task-selected-guidance-v2");
  expect(result.fingerprint).toHaveLength(64);
});

test("unrelated and one-term queries add no guidance and never fall back", () => {
  for (const taskText of [
    "",
    "the and is this",
    "database",
    "databases transactions",
    "Rotate image clockwise",
  ]) {
    const result = selectTaskGuidance({
      taskText,
      corpus: [item({ id: "atomic" })],
    });

    expect(result.packet).toBe("");
    expect(result.selectedIds).toEqual([]);
    expect(result.omissions[0]?.reason).toBe("insufficient-matches");
    expect(result.bytes).toBe(0);
  }
});

test("routing, skill-covered rules, and duplicate instructions are excluded", () => {
  const result = selectTaskGuidance({
    taskText: "database transaction",
    corpus: withBackground([
      item({ id: "a", body: "Keep database transaction atomic." }),
      item({ id: "b", body: "Keep database transaction atomic." }),
      item({ id: "c", excluded: "skill-routing" }),
      item({ id: "d", excluded: "skill-covered" }),
    ]),
  });

  expect(result.selectedIds).toEqual(["a"]);
  expect(
    result.omissions
      .filter((entry) => !entry.id.startsWith("astronomy/"))
      .map((entry) => entry.reason),
  ).toEqual(["duplicate", "skill-routing", "skill-covered"]);
  expect(() =>
    selectTaskGuidance({
      taskText: "database transaction",
      corpus: [item({ id: "same" }), item({ id: "same" })],
    }),
  ).toThrow("identifiers");
});

test("whole blocks obey independent item, UTF-8 byte, and line limits", () => {
  const result = selectTaskGuidance({
    taskText: "database transaction",
    corpus: withBackground([
      item({ id: "a", block: "é".repeat(2049) }),
      item({ id: "b", block: "line\n".repeat(200) }),
      ...["c", "d", "e", "f", "g"].map((id) => item({ id })),
    ]),
  });

  expect(result.selectedIds).toEqual(["c", "d", "e", "f"]);
  expect(
    result.omissions.filter((entry) => !entry.id.startsWith("astronomy/")),
  ).toEqual([
    {
      id: "a",
      reason: "byte-limit",
      matchingTerms: ["database", "transaction"],
    },
    {
      id: "b",
      reason: "line-limit",
      matchingTerms: ["database", "transaction"],
    },
    {
      id: "g",
      reason: "item-limit",
      matchingTerms: ["database", "transaction"],
    },
  ]);
  expect(result.bytes).toBeLessThanOrEqual(4096);
  expect(result.lines).toBeLessThanOrEqual(200);
  expect(result.packet).not.toContain("é");

  const exact = selectTaskGuidance({
    taskText: "database transaction",
    corpus: [item({ id: "exact", block: "é".repeat(2048) })],
  });

  expect(exact.bytes).toBe(4096);
  expect(exact.packet).toBe("é".repeat(2048));
});

test("general-purpose ranking uses titles, applicability, tags, summaries, and reference bodies", () => {
  const corpus = [
    item({
      id: "reference",
      kind: "reference",
      title: "Database reference",
      body: "Database transaction detail",
      summary: "Transaction reference",
      block: "Summary\nRead: .eval-context/references/atomic.md",
    }),
    item({
      id: "deployment",
      title: "Release migration",
      applicability: ["Kubernetes deployment"],
      tags: ["rollout"],
      body: "Check rollout progress.",
      block: "Check rollout progress.",
    }),
    item({
      id: "image",
      title: "Image rotation",
      tags: ["clockwise"],
      body: "Rotate image clockwise.",
      block: "Rotate image clockwise.",
    }),
  ];

  expect(
    selectTaskGuidance({ taskText: "Kubernetes deployment rollout", corpus })
      .selectedIds,
  ).toEqual(["deployment"]);
  expect(
    selectTaskGuidance({ taskText: "Rotate image clockwise", corpus })
      .selectedIds,
  ).toEqual(["image"]);

  const reference = selectTaskGuidance({
    taskText: "Database transaction",
    corpus,
  });

  expect(reference.selectedIds).toEqual(["reference"]);
  expect(reference.packet).not.toContain("detail");
  expect(reference.packet).toContain(
    "Read: .eval-context/references/atomic.md",
  );
});
