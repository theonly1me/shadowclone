import { describe, expect, test } from "bun:test";
import { sampleConfig, sha } from "../fixtures";
import type { PullFacts } from "./resolve";
import { reviewStages } from "./review";

const pull: PullFacts = {
  number: 30,
  branch: "feature",
  head: sha("a"),
  ownerAuthored: true,
  fork: false,
};
const workspace = { root: "/work", repository: "/work/repository", skills: "/work/skills" };

function stages(overrides: Partial<PullFacts>) {
  return reviewStages({ config: sampleConfig(), pull: { ...pull, ...overrides }, workspace });
}

describe("clone reviews", () => {
  test("the owner's own pull request runs the toolchain checks with the network on", () => {
    const result = stages({});

    expect(result.map((stage) => stage.name)).toEqual(["prepare", "checks", "analyze", "publish"]);
    expect(result.find((stage) => stage.name === "analyze")?.arguments).toContain(
      "/work/checks.json",
    );
    expect(result.find((stage) => stage.name === "prepare")?.arguments.join(" ")).toContain(
      "--network on",
    );
  });

  test("a fork or another person's pull request runs none of its code and turns the network off", () => {
    for (const overrides of [{ fork: true }, { ownerAuthored: false }]) {
      const result = stages(overrides);

      expect(result.map((stage) => stage.name)).toEqual(["prepare", "analyze", "publish"]);
      expect(result.find((stage) => stage.name === "analyze")?.arguments.join(" ")).toContain(
        "--network off",
      );
      expect(result.find((stage) => stage.name === "analyze")?.arguments).not.toContain(
        "/work/checks.json",
      );
    }
  });
});
