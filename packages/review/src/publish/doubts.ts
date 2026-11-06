import type { ReviewResult } from "../types";
import { inlineCode } from "./format";
import { neutralizeText } from "./neutralize";

function plural(options: { readonly count: number; readonly word: string }): string {
  return `${options.count} ${options.word}${options.count === 1 ? "" : "s"}`;
}

export function worthCheckingLines(result: ReviewResult): readonly string[] {
  return result.worthChecking.map(
    (doubt) =>
      `- **${neutralizeText(doubt.title)}** at ${inlineCode(`${doubt.path}:${doubt.line}`)}. ${neutralizeText(doubt.failureScenario)} Still open: ${neutralizeText(doubt.reason)}`,
  );
}

export function worthCheckingDetails(result: ReviewResult): string | null {
  if (result.worthChecking.length === 0) {
    return null;
  }

  return [
    "<details>",
    `<summary>Worth checking: ${plural({ count: result.worthChecking.length, word: "unconfirmed candidate" })}</summary>`,
    "",
    "shadowclone could neither confirm nor refute these with quoted code. They are not findings.",
    "",
    ...worthCheckingLines(result),
    "",
    "</details>",
  ].join("\n");
}

export function coverageLine(result: ReviewResult): string {
  const { coverage, statistics } = result;
  const examined = Math.max(0, coverage.hunks - coverage.uncovered.length);
  const lenses = statistics.lensRuns > 0 ? ` ${plural({ count: statistics.lensRuns, word: "lens run" })} searched for specific risks.` : "";

  return `The review examined ${examined} of ${plural({ count: coverage.hunks, word: "changed hunk" })}.${lenses}`;
}
