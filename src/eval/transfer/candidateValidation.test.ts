import { expect, test } from "bun:test";
import {
  additiveTaskExclusionReason,
  candidateExclusionReason,
} from "./candidateValidation";

test("names the invalid preparation field without private content", () => {
  const cases = [
    {
      completion: [],
      preferences: ["preference", "second", "third"],
      reason: "no completion requirements",
    },
    {
      completion: ["complete"],
      preferences: [],
      reason: "no preference requirements",
    },
  ];

  for (const testCase of cases) {
    expect(
      candidateExclusionReason({
        prompt: "Implement the requested change.",
        completion: testCase.completion,
        preferences: testCase.preferences,
      }),
    ).toContain(testCase.reason);
  }

  expect(
    candidateExclusionReason({
      prompt: "Implement the requested change.",
      completion: ["complete"],
      preferences: ["preference", "second", "third"],
    }),
  ).toBeNull();
});

test("rejects tasks that explicitly prohibit repository changes", () => {
  expect(
    candidateExclusionReason({
      prompt: "Investigate the implementation. Do not modify anything.",
      completion: ["Report exact paths and line numbers."],
      preferences: ["Be thorough.", "second", "third"],
    }),
  ).toBe("Candidate is read-only and has no verifiable repository outcome");
});

test("rejects analysis requests without an implementation direction", () => {
  expect(
    candidateExclusionReason({
      prompt:
        "Investigate the account behavior. Follow-up: I want to compare one account with its peers.",
      completion: ["Inspect the account data and explain the difference."],
      preferences: ["Be concise."],
    }),
  ).toBe("Candidate requests analysis without a repository outcome");

  expect(
    candidateExclusionReason({
      prompt:
        "How does the parser handle empty input? Follow-up: What we want is for the parser to return an empty result.",
      completion: ["Return an empty result for empty input."],
      preferences: ["Use complete variable names."],
    }),
  ).toBeNull();
});

test("requires generated tasks to add new code and exercise multiple preferences", () => {
  expect(additiveTaskExclusionReason({
    prompt: "Update the existing parser and its tests.",
    preferences: ["Use complete names", "Avoid casts", "Keep files short"],
  })).toContain("new code");
  expect(additiveTaskExclusionReason({
    prompt: "Create a new parser utility and focused tests.",
    preferences: ["Use complete names"],
  })).toContain("three applicable preferences");
  expect(additiveTaskExclusionReason({
    prompt: "Create a new parser utility and focused tests.",
    preferences: ["Use complete names", "Avoid casts", "Keep files short"],
  })).toBeNull();
});
