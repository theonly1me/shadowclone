import { expect, test } from "bun:test";
import { fingerprint } from "../transfer/structured";
import { candidateFixture, guidanceFixture } from "./fixtures";
import { judgeGuidance } from "./judge";
import { adherenceCases, sourceJudgingFixture } from "./judgeAdherence.fixtures";
import { adherenceJudgeInstructions, judgePromptFingerprint, sourceJudgePromptFingerprint } from "./judgePrompt";
import { sourceJudgingSchema } from "./sourceEvidenceSchema";

test("source judge versions retain historical fingerprints and freeze the clarified contract", () => {
  expect(judgePromptFingerprint()).toBe("fbaf4710c0ba13e2bbe98176aa2585963dbcd127c1471f24180d5b7283dabdaa");
  expect(sourceJudgePromptFingerprint()).toBe("7f02776f1cc0e07bbaa28a49c5f4d6788ac86cbdafc63696a3726e4693632355");
  expect(sourceJudgePromptFingerprint(4)).toBe("180d06c39631710e09ff99c60f99badc344431994ce615c94ce39efa29112da6");
  for (const version of [3, 4] as const) expect(sourceJudgingSchema.parse(sourceJudgingFixture(version)).version).toBe(version);
});

for (const fixture of adherenceCases) test(`offline prompt contract: ${fixture.name}`, async () => {
  const scenario = guidanceFixture().scenarios.find((entry) => entry.mode === "advice");
  if (!scenario) throw new Error("Advice fixture missing");
  const prompts: string[] = [];
  const judging = sourceJudgingFixture(4);
  const originalFingerprint = fingerprint(judging);
  const candidateEvidence = { response: fixture.response };
  for (const arm of ["bare", "skills", "memory", "clone"] as const) {
    const checks = await judgeGuidance({
      scenario: { ...scenario, criteria: scenario.criteria.map((criterion) => ({ ...criterion, requirement: fixture.requirement })) },
      candidate: { ...candidateFixture(), arm, evidence: JSON.stringify(candidateEvidence) }, vote: 1, cwd: "/synthetic", sourceJudging: judging,
      call: async (request) => {
        prompts.push(request.prompt);
        expect(request.access).toBe("none");
        expect(request.outputSchema).toHaveProperty("$schema", "http://json-schema.org/draft-07/schema#");
        return { engine: "claude-code", sessionId: "synthetic", transcriptPath: null, text: "", costUsd: 0, durationMs: 0, turns: 1, isError: false,
          structured: { checks: [{ id: "complete-names", verdict: "unknown", evidence: "Synthetic response only; no model reasoning is tested." }] },
          permissionDenials: [], actions: [], errorMessage: null };
      },
    });
    expect(checks[0]?.verdict).toBe("unknown");
  }
  expect(new Set(prompts).size).toBe(1);
  const [prompt] = prompts;
  if (!prompt) throw new Error("Judge prompt missing");
  expect(prompt).toContain(fixture.contract);
  expect(prompt).toContain("A valid command does not excuse a conflicting runnable alternative");
  expect(prompt).toContain("not proof that the alternative cannot run");
  expect(prompt).toContain("Runtime behavior remains unverified without direct evidence");
  const payload = JSON.parse(prompt.slice(prompt.lastIndexOf("\n\n") + 2));
  expect(payload.candidate).toEqual(candidateEvidence);
  expect(payload.criteria[0].requirement).toBe(fixture.requirement);
  expect(payload.sourceEvidence).toEqual(judging.packet);
  for (const hidden of ['"arm"', '"provenance"', "private-source-", "requiredSkills", '"reads"']) expect(prompt).not.toContain(hidden);
  expect(fingerprint(judging)).toBe(originalFingerprint);
});

test("version 3 keeps its original prompt while version 4 appends only the clarification", async () => {
  const scenario = guidanceFixture().scenarios.find((entry) => entry.mode === "advice");
  if (!scenario) throw new Error("Advice fixture missing");
  const prompts: string[] = [];
  for (const version of [3, 4] as const) await judgeGuidance({ scenario, candidate: candidateFixture(), vote: 1, cwd: "/synthetic",
    sourceJudging: sourceJudgingFixture(version), call: async (request) => {
      prompts.push(request.prompt);
      return { engine: "claude-code", sessionId: "synthetic", transcriptPath: null, text: "", costUsd: 0, durationMs: 0, turns: 1, isError: false,
        structured: { checks: [{ id: "complete-names", verdict: "unknown", evidence: "Synthetic" }] }, permissionDenials: [], actions: [], errorMessage: null };
    },
  });
  const [historical, clarified] = prompts;
  expect(historical).not.toContain("Separate source adherence from technical validity");
  expect(clarified?.replace(`${adherenceJudgeInstructions.join("\n\n")}\n\n`, "")).toBe(historical);
});

test("a mismatched judge version and fingerprint stops before any invocation", async () => {
  const [scenario] = guidanceFixture().scenarios;
  if (!scenario) throw new Error("Scenario fixture missing");
  let calls = 0;
  await expect(judgeGuidance({ scenario, candidate: candidateFixture(), vote: 1, cwd: "/synthetic",
    sourceJudging: { ...sourceJudgingFixture(4), promptFingerprint: sourceJudgePromptFingerprint(3) },
    call: async () => { calls += 1; throw new Error("Must not call"); },
  })).rejects.toThrow("fingerprint");
  expect(calls).toBe(0);
});
