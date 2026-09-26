import { expect, test } from "bun:test";
import { deterministicChecks } from "./checks";
import { candidateFixture, guidanceFixture } from "./fixtures";
import { aggregateChecks, judgeGuidance } from "./judge";
import type { GuidanceScenario } from "./schema";

test("deterministic checks ignore string contents and allow as const", () => {
  const [source] = guidanceFixture().scenarios;
  if (!source) throw new Error("Fixture scenario missing");
  const scenario: GuidanceScenario = { ...source, criteria: ["type-safety", "zero-comments", "file-length"].map((id) => ({
    id, check: id === "type-safety" ? "type-safety" : id === "zero-comments" ? "zero-comments" : "file-length",
    dimension: "preferences", requirement: id, source: { path: "fixture", quote: id },
  })) };
  const result = deterministicChecks({ scenario, files: [{ path: "index.ts", content: 'export const url = "https://example.com" as const;\nexport const slash = /\\//g;' }] });
  expect(result.checks.every((check) => check.verdict === "pass")).toBeTrue();
  expect(result.verification).toBe("not-verified");
  const failing = deterministicChecks({ scenario, files: [{ path: "index.ts", content: "export const input: any = 1;\n// prohibited comment\n" }] });
  expect(failing.checks.filter((check) => check.verdict === "fail").map((check) => check.id)).toEqual(["type-safety", "zero-comments"]);
  expect(deterministicChecks({ scenario, files: [] }).checks.every((check) => check.verdict === "unknown")).toBeTrue();
  expect(deterministicChecks({ scenario, files: [{ path: "identifier.ts", content: "const identifier = (namespace + separator + value) as NamespacedId;" }] }).checks.find((check) => check.id === "type-safety")?.verdict).toBe("fail");
});

test("disagreement remains unknown and never turns into a favorable score", () => {
  const candidate = candidateFixture();
  expect(aggregateChecks({ ...candidate, votes: [
    { vote: 1, checks: [{ id: "naming", verdict: "pass", evidence: "full name" }] },
    { vote: 2, checks: [{ id: "naming", verdict: "fail", evidence: "abbreviated name" }] },
  ] })[0]?.verdict).toBe("unknown");
});

test("judge gets visible outcomes, exact sources, and anonymous evidence but no routing trace", async () => {
  const [scenario] = guidanceFixture().scenarios;
  if (!scenario) throw new Error("Fixture scenario missing");
  let prompt = "";
  const result = await judgeGuidance({ scenario, candidate: candidateFixture(), vote: 1, cwd: "/snapshot", call: async (request) => {
    prompt = request.prompt;
    expect(request.outputSchema).toHaveProperty("$schema", "http://json-schema.org/draft-07/schema#");
    return { engine: "claude-code", sessionId: "fixture", transcriptPath: null, text: "", structured: { checks: [{ id: "complete-names", verdict: "pass", evidence: "Complete names present." }] }, costUsd: 0, durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
  } });
  expect(result).toHaveLength(1);
  expect(prompt).toContain("Produce the requested result.");
  expect(prompt).toContain("Missing execution output is unverified");
  expect(prompt).not.toContain('"arm"');
  expect(prompt).not.toContain("requiredSkills");
});
