import { expect, test } from "bun:test";
import type { EngineRunOptions } from "@shadowclone/agents";
import { collectReview } from "../collect";
import { createGitFixture } from "../collect/gitFixture";
import { engineRun, fullCoverage, lensesOff, promptHunks } from "../engineFixture";
import { reviewMarkdown } from "../markdown";
import { analyzeStage } from "./analyze";
import type { PacketFile } from "./schemas";

const valueLines = Array.from({ length: 40 }, (_, index) => `export const value${index + 1} = ${index + 1};`);

async function twoHunkPacket(): Promise<{ readonly packet: PacketFile; readonly checkout: string }> {
  const fixture = await createGitFixture();
  await fixture.write({ "src/values.ts": `${valueLines.join("\n")}\n` });
  const baseSha = fixture.commit("base");
  const changed = valueLines.map((line, index) => (index === 1 || index === 30 ? line.replace("= ", "= 1 + ") : line));
  await fixture.write({ "src/values.ts": `${changed.join("\n")}\n` });
  const headSha = fixture.commit("head");
  const context = await collectReview({
    checkout: fixture.directory,
    facts: { repository: "example/app", number: 1, title: "t", body: "", baseRefName: "main", baseSha, headSha },
  });

  return { packet: { version: 1, context, ruleHits: [], reports: [] }, checkout: fixture.directory };
}

function reviewWith(options: { readonly answer: (prompt: string) => object; readonly prompts: string[] }) {
  return async (run: EngineRunOptions) => {
    options.prompts.push(run.prompt);
    return engineRun({ structured: options.answer(run.prompt) });
  };
}

const candidate = { path: "src/values.ts", failureScenario: "A caller reads the wrong value." };

test("an answer that skips a hunk gets a correction round that names it, and a hunk that stays unread is listed as not examined", async () => {
  const { packet, checkout } = await twoHunkPacket();
  const prompts: string[] = [];
  const firstHunkOnly = (prompt: string) => ({
    findings: [],
    dropped: [],
    coverage: fullCoverage(prompt).slice(0, 1),
  });
  const result = await analyzeStage({
    packet,
    checks: null,
    checkout,
    reviewModel: { runner: reviewWith({ answer: firstHunkOnly, prompts }), model: "m", effort: null, network: false, lenses: lensesOff },
  });

  expect(promptHunks(prompts[0] ?? "")).toEqual(["H1", "H2"]);
  expect(prompts).toHaveLength(2);
  expect(prompts[1]).toContain("H2 have no coverage entry");
  expect(result.coverage).toEqual({ hunks: 2, uncovered: ["src/values.ts:28-34"] });
  expect(reviewMarkdown(result)).toContain("The review examined 1 of 2 changed hunks.");
  expect(reviewMarkdown(result)).toContain("## Not examined\n\n- src/values.ts:28-34");
});

test("a rejection whose quote does not match the code stays worth checking, and a rejection with a matching quote is refuted", async () => {
  const { packet, checkout } = await twoHunkPacket();
  const answer = (prompt: string) => ({
    findings: [],
    dropped: [],
    coverage: fullCoverage(prompt),
    rejected: [
      {
        ...candidate,
        line: 2,
        title: "Value two is off by one",
        refutation: "The new value is intended.",
        evidence: [{ source: "code", location: "src/values.ts:2", quote: "export const value2 = 1 + 2;" }],
      },
      {
        ...candidate,
        line: 31,
        title: "Value thirty-one is wrong",
        refutation: "A test covers it.",
        evidence: [{ source: "code", location: "src/values.ts:31", quote: "expect(value31).toBe(32);" }],
      },
    ],
    unresolved: [{ ...candidate, line: 20, title: "Value twenty may be stale", reason: "No caller in this repository reads it." }],
  });
  const result = await analyzeStage({
    packet,
    checks: null,
    checkout,
    reviewModel: { runner: reviewWith({ answer, prompts: [] }), model: "m", effort: null, network: false, lenses: lensesOff },
  });

  expect(result.refuted.map((entry) => entry.title)).toEqual(["Value two is off by one"]);
  expect(result.worthChecking.map((entry) => [entry.title, entry.reason.split(":")[0]])).toEqual([
    ["Value thirty-one is wrong", "The refutation did not hold"],
    ["Value twenty may be stale", "No caller in this repository reads it."],
  ]);
  expect(reviewMarkdown(result)).toContain("## Worth checking");
});
