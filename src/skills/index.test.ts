import { expect, test } from "bun:test";
import path from "node:path";
import { loadSeedSkillLibrary } from "./index";
import { parseSeedSkillDocument } from "./parse";

const skillIds = [
  "comments-none",
  "comments-public",
  "comments-why",
  "dependencies-existing",
  "dependencies-mature",
  "design-deep-modules",
  "investigate-before-editing",
  "planning-first",
  "planning-when-costly",
  "prove-regression-tests",
  "questions-autonomous",
  "questions-early",
  "refactor-boundaries",
  "refactor-preserve",
  "resolve-conflicts-by-intent",
  "scope-confirmed-changes",
  "testing-first",
  "testing-risk-based",
  "typescript-type-safety",
  "verify-and-review",
];

test("loads the complete seed library with valid axis choices", async () => {
  const library = await loadSeedSkillLibrary({
    directory: path.resolve(import.meta.dir, "../../skills"),
  });

  expect(library.skills.map((skill) => skill.id)).toEqual(skillIds);
  expect(
    library.axes.map((axis) => [axis.id, axis.skills.length]),
  ).toEqual([
    ["comment-policy", 3],
    ["dependency-posture", 2],
    ["planning-threshold", 2],
    ["question-frequency", 2],
    ["refactor-tolerance", 2],
    ["testing-approach", 2],
  ]);
  expect(library.disciplines).toHaveLength(7);

  const assignedIds = library.axes.flatMap((axis) =>
    axis.skills.map((skill) => skill.id),
  );
  expect(new Set(assignedIds).size).toBe(assignedIds.length);
});

test("rejects metadata outside the closed skill schema", () => {
  expect(() =>
    parseSeedSkillDocument({
      filename: "comments-none.md",
      text: [
        "---",
        "id: comments-none",
        "title: Write no comments",
        "axis: comment-policy",
        "category: communication",
        "section: engineering",
        "applies-when:",
        "  - writing code",
        "command: implement",
        "---",
        "## Write no comments",
        "",
        "Let names and structure carry the explanation.",
      ].join("\n"),
    }),
  ).toThrow("Invalid skill metadata in comments-none.md");
});

test("rejects duplicate frontmatter keys before YAML replaces them", () => {
  expect(() =>
    parseSeedSkillDocument({
      filename: "comments-why.md",
      text: [
        "---",
        "id: comments-none",
        "id: comments-why",
        "title: Comment decisions, not mechanics",
        "axis: comment-policy",
        "category: communication",
        "section: engineering",
        "applies-when:",
        "  - writing code",
        "---",
        "## Comment decisions, not mechanics",
        "",
        "Preserve decisions that code cannot express.",
      ].join("\n"),
    }),
  ).toThrow("Invalid skill metadata in comments-why.md");
});

test("rejects a title that disagrees with the visible profile block", () => {
  expect(() =>
    parseSeedSkillDocument({
      filename: "comments-none.md",
      text: [
        "---",
        "id: comments-none",
        "title: Write no comments",
        "axis: comment-policy",
        "category: communication",
        "section: engineering",
        "applies-when:",
        "  - writing code",
        "---",
        "## Explain everything",
        "",
        "Add commentary throughout the implementation.",
      ].join("\n"),
    }),
  ).toThrow("Skill heading does not match its title in comments-none.md");
});
