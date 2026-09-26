import { expect, test } from "bun:test";
import { compileProfile, defaultIndexByteBudget } from "./index";
import type { ProfileRule } from "./index";

function rule(options: {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly appliesWhen?: readonly string[];
  readonly source?: ProfileRule["source"];
}): ProfileRule {
  return {
    key: options.key,
    title: options.title,
    body: options.body,
    section: "engineering",
    scope: "global",
    originDirectory: null,
    repositoryName: null,
    source: options.source ?? "mined",
    status: "active",
    proposal: null,
    appliesWhen: options.appliesWhen ?? [],
    evidence: { for: [], against: [] },
    observations: 1,
    lastSeen: "2026-09-26",
    sessions: 3,
    origins: [],
    importReference: null,
  };
}

test("the index renders one line per rule with its first sentence and conditions", async () => {
  const compilation = await compileProfile({
    input: { kind: "rules", rules: [
      rule({ key: "options", title: "Options objects", body: "Use one options object for two or more arguments. Positional arguments hide meaning.", appliesWhen: ["writing TypeScript"] }),
      rule({ key: "fenced", title: "Commit format", body: "```\nfeat: add parser\n```" }),
    ] },
    format: "index",
  });
  expect(compilation.markdown).toContain("- Options objects: Use one options object for two or more arguments. (when writing TypeScript)\n");
  expect(compilation.markdown).toContain("- Commit format\n");
  expect(compilation.markdown).not.toContain("Positional arguments hide meaning");
  expect(compilation.markdown).not.toContain("Guidance source");
  expect(Buffer.byteLength(compilation.markdown, "utf8")).toBe(compilation.usedBytes);
});

test("the index stays within 4 KiB by omitting whole lines", async () => {
  const rules = Array.from({ length: 80 }, (_, index) =>
    rule({ key: `rule-${String(index).padStart(2, "0")}`, title: `Rule ${index}`, body: `Keep behavior ${"x".repeat(60)} number ${index}.` }));
  const compilation = await compileProfile({ input: { kind: "rules", rules }, format: "index" });
  expect(Buffer.byteLength(compilation.markdown, "utf8")).toBeLessThanOrEqual(defaultIndexByteBudget);
  expect(compilation.omissions.filter((omission) => omission.reason === "budget").length).toBeGreaterThan(0);
  expect(compilation.markdown.endsWith("\n")).toBeTrue();
  for (const line of compilation.markdown.split("\n").filter((entry) => entry.startsWith("- "))) {
    expect(line).toMatch(/^- Rule \d+: Keep behavior x+ number \d+\.$/);
  }
});

test("an empty index emits nothing so hooks can stay silent", async () => {
  const compilation = await compileProfile({ input: { kind: "rules", rules: [] }, format: "index" });
  expect(compilation.markdown).toBe("");
  expect(compilation.appliedRuleCount).toBe(0);
});

test("a rule already stated in native guidance is omitted as a known duplicate", async () => {
  const compilation = await compileProfile({
    input: { kind: "rules", rules: [
      rule({ key: "gate", title: "Run the gate", body: "Run `bun run check` before presenting any change." }),
      rule({ key: "names", title: "Complete names", body: "Use full words in identifiers." }),
    ] },
    format: "index",
    knownNativeText: ["## Commands\n\nRun bun run check before presenting any change. CI runs the same gate."],
  });
  expect(compilation.markdown).not.toContain("Run the gate");
  expect(compilation.markdown).toContain("- Complete names: Use full words in identifiers.");
  expect(compilation.omissions).toContainEqual({ ruleKey: "gate", reason: "known-duplicate" });
});

test("a short probe is too weak to count as a known duplicate", async () => {
  const compilation = await compileProfile({
    input: { kind: "rules", rules: [rule({ key: "short", title: "Test", body: "Test it." })] },
    format: "index",
    knownNativeText: ["Test it. Always."],
  });
  expect(compilation.markdown).toContain("- Test: Test it.");
});
