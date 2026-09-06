import { expect, test } from "bun:test";
import { parseJudgment } from "./judge";

test("rejects incomplete verdicts and unsupported labels", () => {
  expect(() => parseJudgment({ text: '{"checks":[]}', requirements: ["Run tests"] })).toThrow("incomplete");
  expect(() => parseJudgment({ text: '{"checks":[{"verdict":"probably","evidence":"claim"}]}', requirements: ["Run tests"] })).toThrow("invalid");
});

test("preserves insufficient evidence instead of rewarding claimed success", () => {
  expect(parseJudgment({ text: '{"checks":[{"verdict":"uncertain","evidence":"No completed test invocation"}]}', requirements: ["Run tests"] })[0]?.verdict).toBe("uncertain");
});
