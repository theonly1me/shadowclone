import { expect, test } from "bun:test";
import { compileCodeRubric } from "./codeRubric";
import { batchReply, judgeRequest } from "./judgeFixtures";
import { judgeCandidate } from "./pairJudge";
import { fingerprint } from "./structured";

const requirement = "Prefer kebab case for strings, and camelCase for everything else: variables, database columns and Prisma schema fields.";
const preferences = compileCodeRubric([{ relativePath: "skills/naming/SKILL.md", content: requirement }]);

test("freezes the clarified naming scope without weakening variable naming or changing the source quote", () => {
  const [check] = preferences;
  expect(check?.requirement).toBe(requirement);
  expect(check?.rubric?.version).toBe(2);
  expect(check?.rubric?.interpretation).toContain("PascalCase type");
  expect(check?.rubric?.interpretation).toContain("Human-readable error messages");
  expect(check?.rubric?.interpretation).toContain("camelCase for freely chosen value identifiers");
  expect(check?.rubric?.interpretation).toContain("kebab-case for symbolic string identifiers");
  expect(check?.rubric?.fingerprint).not.toBe(fingerprint(requirement));
});

test("every naming judge receives the frozen clarification for the candidate it grades", async () => {
  const evidence = "export type ByteUnit = 'B'; const byteCount = 1; throw new Error('Invalid byte quantity');";
  let calls = 0;
  await judgeCandidate({
    taskPrompt: "Add a byte quantity module.", correctness: [], preferences, evidence,
    cwd: "/tmp", onVote: async () => undefined,
    call: async (request) => {
      calls += 1;
      expect(request.prompt).toContain("user's approved scope clarification");
      expect(request.prompt).toContain("PascalCase type");
      expect(request.prompt).toContain("Human-readable error messages");
      expect(judgeRequest(request.prompt).requirements[0]?.requirement).toBe(requirement);
      return batchReply(request);
    },
  });
  expect(calls).toBe(3);
});
