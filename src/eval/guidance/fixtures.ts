import { suiteSchema, type GuidanceResult } from "./schema";
import { fingerprint } from "../transfer/structured";
import { contractProofSchema, legacySchemaFailure } from "./claudeContract";
import { judgmentOutputSchema, legacyJudgmentOutputSchema } from "./judgeSchema";

export function guidanceFixture() {
  const requirement = "Use complete names.";
  return suiteSchema.parse({
    protocol: "guidance-v1", schemaVersion: 1, suiteId: crypto.randomUUID(), repository: "/snapshot/repository", baseCommit: "frozen-head",
    context: [{ relativePath: "skills/0/clean-code/SKILL.md", content: `---\nname: clean-code\ndescription: Mandatory before edits.\n---\n${requirement}` }],
    memory: [{ relativePath: "memory/MEMORY.md", content: "Read reference_queue.md" }, { relativePath: "memory/reference_queue.md", content: "Queue retries use a separate budget." }],
    references: [{ relativePath: "references/reference_queue.md", content: "Queue retries use a separate budget." }],
    profile: "Load clean-code before editing.", bootstrap: "Use the available skill catalog.", sourcesFingerprint: "frozen-context",
    scenarios: ["implementation", "fix", "memory", "knowledge"].map((id, index) => ({
      id, mode: index < 2 ? "code" : "advice", pilot: index === 0 || index === 2,
      prompt: `Complete the ${id} task.`, completion: ["Produce the requested result."],
      criteria: [{ id: "complete-names", dimension: "preferences", requirement, source: { path: "skills/0/clean-code/SKILL.md", quote: requirement }, check: "judged" }],
      expectedSkills: ["clean-code"], expectedReferences: index < 2 ? [] : ["reference_queue.md"],
    })),
  });
}

export function candidateFixture(): GuidanceResult {
  return {
    scenarioId: "implementation", repeat: 0, arm: "clone", resolvedModel: "claude-sonnet-5", evidence: JSON.stringify({ response: "Use a separate retry budget." }),
    reads: [], requiredSkills: [], expectedReferences: [], safety: "pass", safetyEvidence: "Unchanged metadata", verification: "not-verified", deterministic: [], votes: [], complete: false,
  };
}

export function contractFixture() {
  return contractProofSchema.parse({
    checkedAt: Date.now(), cliVersion: "2.1.267 (Claude Code)", executableFingerprint: fingerprint("synthetic-cli"),
    legacySchemaFingerprint: fingerprint(legacyJudgmentOutputSchema), currentSchemaFingerprint: fingerprint(judgmentOutputSchema),
    legacyMessages: 0, currentMessages: 1, legacyFailure: legacySchemaFailure, network: "loopback-only",
  });
}
