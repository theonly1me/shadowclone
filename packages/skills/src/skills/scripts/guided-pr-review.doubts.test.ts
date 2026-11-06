import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { build, embedded, fixture, skillDirectory } from "./guidedFixture.js";

type EmbeddedFinding = { readonly id: string; readonly pr: string; readonly doubt?: boolean; readonly refutation: string };

function isEmbeddedReview(value: unknown): value is { readonly pulls: readonly { readonly findings: readonly EmbeddedFinding[] }[] } {
  return typeof value === "object" && value !== null && "pulls" in value && Array.isArray(value.pulls);
}

test("a worth-checking item becomes a card with its own label, and the panel states the hunks that the reviewer examined", async () => {
  const context = await fixture();
  const [pull] = context.input.pulls;
  if (!pull) throw new Error("Missing fixture pull.");
  const doubt = { path: "job.ts", line: 1, title: "Retries may repeat the side effect", failureScenario: "A retry runs the job twice.", reason: "No caller shows whether the job is idempotent." };
  await writeFile(
    pull.reviewFile,
    JSON.stringify({
      pull: { repository: "example/project", baseSha: pull.baseSha, headSha: pull.headSha },
      findings: [],
      worthChecking: [doubt],
      coverage: { hunks: 4, uncovered: ["job.ts:1-2"] },
      skippedPaths: [],
    }),
  );

  expect(build(context).exitCode).toBe(0);
  const html = await Bun.file(context.outputPath).text();
  const data = embedded(html);
  if (!isEmbeddedReview(data)) throw new Error("No embedded pulls.");
  const [card] = data.pulls.flatMap((entry) => entry.findings);
  if (!card) throw new Error("No embedded card.");
  const { findingMarkup } = await import(path.join(skillDirectory, "assets/presentation.mjs"));
  Object.assign(globalThis, { review: { ...data, annotations: { decisions: {} } } });

  expect([card.doubt, card.refutation]).toEqual([true, doubt.reason]);
  expect(html).toContain('<p class="coverage">#1: the agent examined 3 of 4 changed hunks.</p>');
  expect(findingMarkup(card)).toContain("<span>worth checking</span>");
  expect(findingMarkup(card)).toContain("<strong>Still open:</strong> No caller shows whether the job is idempotent.");
});
