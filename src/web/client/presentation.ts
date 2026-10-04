import type { BrowserItem } from "../protocol";

const presentations: Readonly<
  Record<string, { readonly title: string; readonly summary: string }>
> = {
  "design-deep-modules": {
    title: "Deep modules",
    summary:
      "Keep interfaces small and useful. Put complexity behind a clear boundary so callers have less to understand.",
  },
  "typescript-type-safety": {
    title: "Explicit types",
    summary:
      "Represent valid states in the type system. Narrow uncertain values and keep unsafe assertions out of the implementation.",
  },
  "choose-by-consequence": {
    title: "Fail loudly",
    summary:
      "Compare each shortcut by what it does to the user's files and output. Pick the option that fails loudly and keeps counts true.",
  },
  "scope-confirmed-changes": {
    title: "Scoped changes",
    summary:
      "Confirm the problem before editing. Keep the change focused, preserve surrounding behavior, and verify the result.",
  },
  "diagnose-before-editing": {
    title: "Prove the bug",
    summary:
      "Trace the failure and establish its cause before changing code. Use evidence to choose the smallest useful fix.",
  },
  "tests-that-catch-bugs": {
    title: "Tests that catch bugs",
    summary:
      "Write a few tests that each name the bug they catch, check what the user sees, and fail when the fix is removed.",
  },
  "verify-and-review": {
    title: "Verify the real outcome",
    summary:
      "Run what the user runs, read every count and exit code, and label each claim as measured, inferred, or not verified.",
  },
  "research-primary-sources": {
    title: "Go to the source",
    summary:
      "Check authoritative documentation and original evidence when a technical decision depends on facts that need verification.",
  },
  "planning-first": {
    title: "Plan the change",
    summary:
      "Establish the approach before implementation so the scope, decisions, and intended outcome are clear.",
  },
  "planning-when-costly": {
    title: "Plan when it matters",
    summary:
      "Move directly on straightforward tasks. Pause for a plan when the cost, uncertainty, or consequences call for one.",
  },
  "questions-autonomous": {
    title: "Keep moving",
    summary:
      "Use judgment to resolve routine choices. Ask when missing information changes the outcome or an action needs authorization.",
  },
  "questions-early": {
    title: "Ask early",
    summary:
      "Resolve meaningful uncertainty with the user before investing in an implementation built on the wrong assumption.",
  },
  "resolve-conflicts-by-intent": {
    title: "Preserve intent",
    summary:
      "Understand what both sides of a merge are trying to achieve. Resolve the conflict and verify the combined behavior.",
  },
  "dependencies-existing": {
    title: "Know your tools",
    summary:
      "Look for a solution in the existing stack before adding another dependency.",
  },
  "dependencies-mature": {
    title: "Choose proven tools",
    summary:
      "Use established, focused packages when they provide substantial reusable logic and justify the dependency.",
  },
  "refactor-boundaries": {
    title: "Improve boundaries",
    summary:
      "Make a refactor when it improves responsibilities and simplifies the change. Keep its purpose connected to the task.",
  },
  "refactor-preserve": {
    title: "Respect the structure",
    summary:
      "Work within the current structure and preserve unrelated code while making the requested change.",
  },
};

export function skillTitle(item: BrowserItem): string {
  return presentations[item.id]?.title ?? item.title;
}

export function skillSummary(options: {
  readonly item: BrowserItem;
  readonly editedText?: string;
}): string {
  const prepared = presentations[options.item.id];

  if (
    prepared &&
    options.editedText === undefined &&
    options.item.owner === "packaged"
  ) {
    return prepared.summary;
  }

  const body = (options.editedText ?? options.item.text)
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .split("\n")
    .filter(
      (line) => line.trim() && !line.startsWith("#") && !line.startsWith("```"),
    )
    .slice(0, 2)
    .join(" ")
    .replace(/\*\*/g, "");

  return body.length > 320 ? `${body.slice(0, 317).trimEnd()}…` : body;
}

export const featuredSkills = [
  "design-deep-modules",
  "typescript-type-safety",
  "refactor-preserve",
  "diagnose-before-editing",
  "tests-that-catch-bugs",
  "verify-and-review",
  "planning-first",
  "questions-autonomous",
  "scope-confirmed-changes",
];
