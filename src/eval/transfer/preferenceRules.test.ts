import { expect, test } from "bun:test";
import { preferenceSources, resolvePreferenceRules, sourceRules } from "./preferenceRules";

test("preserves exact nested rules and examples with source locations", () => {
  const requirement = [
    "- **No casts.** Only as const is allowed.",
    "  - Do not copy casts from existing files.",
    "  ```ts",
    "  const heading = '# This is code';",
    "  ```",
  ].join("\n");
  const optionsRule = "- **Two or more arguments take a single options object**, never positional. This applies to internal helpers too.";
  const source = {
    relativePath: "skills/0/clean-code/SKILL.md",
    content: [
      "---", "name: clean-code", "---", "# Clean code", "## TypeScript",
      requirement, optionsRule, "## Comments", "Write zero comments. No exceptions.",
    ].join("\n"),
  };
  expect(sourceRules(source)).toEqual([
    {
      requirement,
      source: { relativePath: source.relativePath, heading: "Clean code > TypeScript", line: 6 },
    },
    {
      requirement: optionsRule,
      source: { relativePath: source.relativePath, heading: "Clean code > TypeScript", line: 11 },
    },
    {
      requirement: "Write zero comments. No exceptions.",
      source: { relativePath: source.relativePath, heading: "Clean code > Comments", line: 13 },
    },
  ]);
});

test("does not interpret headings and list items inside fenced examples", () => {
  const content = [
    "Use the following format.", "~~~md", "# Example", "- Example item", "~~~",
    "## Naming", "- Use full words.",
  ].join("\n");
  const rules = sourceRules({ relativePath: "instructions/0.md", content });
  expect(rules).toHaveLength(2);
  expect(rules[0]?.requirement).toBe(content.split("\n## Naming")[0]);
  expect(rules[1]?.source.line).toBe(7);
});

test("deduplicates copied rule blocks without changing their text", () => {
  const content = "# Naming\n\n- Use full words.\n- Never use single-letter names.";
  const sources = preferenceSources({
    context: [
      { relativePath: "skills/0/naming/SKILL.md", content },
      { relativePath: "skills/1/naming/SKILL.md", content },
    ],
    profile: "Use complete names.",
  });
  const rules = resolvePreferenceRules({
    sources,
    selectedPaths: sources.map((source) => source.relativePath),
  });
  expect(rules).toHaveLength(3);
  expect(rules[0]?.source.relativePath).toBe("skills/0/naming/SKILL.md");
  expect(rules[2]?.source.relativePath).toBe("profile.md");
});

test("rejects invented source paths instead of accepting invented criteria", () => {
  expect(() => resolvePreferenceRules({
    sources: [{ relativePath: "profile.md", content: "Use full words." }],
    selectedPaths: ["skills/not-captured/SKILL.md"],
  })).toThrow("unknown preference source");
});

test("mandatory skill coverage does not depend on its name or model selection", () => {
  const rules = resolvePreferenceRules({
    sources: [
      {
        relativePath: "skills/0/engineering-conventions/SKILL.md",
        content: "---\nname: engineering-conventions\ndescription: Apply to all coding tasks.\n---\nUse options objects for multiple arguments.",
      },
      {
        relativePath: "skills/0/review/SKILL.md",
        content: "---\nname: review\ndescription: Use only for PR reviews.\n---\nAn example mentions on every task.",
      },
      { relativePath: "profile.md", content: "Use full names." },
    ],
    selectedPaths: ["profile.md"],
  });
  expect(rules.map((rule) => rule.requirement)).toEqual([
    "Use options objects for multiple arguments.",
    "Use full names.",
  ]);
});
