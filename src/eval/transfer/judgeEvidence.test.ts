import { expect, test } from "bun:test";
import { judgeEvidence } from "./judgeEvidence";
import type { CheckResult } from "./types";

const leakedHostFile = "ssh-rsa AAAAB3NzaC1yc2EAAAA host key from the home dir";

const verification: readonly CheckResult[] = [
  {
    requirement: "Independent check: bun run test",
    verdict: "fail",
    evidence: `Exit code 1\n${leakedHostFile}\n`,
  },
  {
    requirement: "Independent check: bun run typecheck",
    verdict: "pass",
    evidence: "Exit code 0\n",
  },
];

test("the judge receives a verdict for each check and none of its output", () => {
  const evidence = judgeEvidence({ observed: "{}", verification });

  expect(evidence).not.toContain(leakedHostFile);
  expect(evidence).not.toContain("Exit code");
  expect(evidence).toContain("Independent check: bun run test");
  expect(evidence).toContain("fail");
  expect(evidence).toContain("pass");
});

test("the judge still receives the observed workspace", () => {
  const evidence = judgeEvidence({
    observed: JSON.stringify({ files: [{ path: "src/main.ts" }] }),
    verification: [],
  });

  expect(evidence).toContain("src/main.ts");
  expect(JSON.parse(evidence).independentVerification).toEqual([]);
});

test("a check keeps its output for the local receipt", () => {
  expect(verification[0]?.evidence).toContain(leakedHostFile);
});
