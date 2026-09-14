import { expect, test } from "bun:test";
import { aggregateVotes, preferenceMajority } from "./aggregateVotes";
import type { PreferenceVerdict } from "./types";

const cases: readonly {
  readonly votes: readonly PreferenceVerdict[];
  readonly expected: PreferenceVerdict;
}[] = [
  { votes: ["not-applicable", "not-applicable", "fail"], expected: "not-applicable" },
  { votes: ["pass", "pass", "not-applicable"], expected: "pass" },
  { votes: ["fail", "fail", "not-applicable"], expected: "fail" },
  { votes: ["pass", "fail", "not-applicable"], expected: "fail" },
];

for (const scenario of cases) {
  test(`aggregates ${scenario.votes.join(", ")} without rewarding abstention`, () => {
    const votes = scenario.votes.map((verdict) => [{
      verdict,
      evidence: `Observed ${verdict}`,
    }]);
    const results = aggregateVotes({
      requirements: ["Two or more arguments take a single options object."],
      votes,
      resolve: preferenceMajority,
    });
    expect(results[0]?.verdict).toBe(scenario.expected);
    expect(results[0]?.votes).toEqual(votes.flat());
  });
}
