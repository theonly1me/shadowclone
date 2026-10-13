import { describe, expect, test } from "bun:test";
import { sampleConfig, sha } from "../fixtures";
import type { SessionRequest } from "../trigger/event";
import { reviewStages } from "./review";

const request: SessionRequest = {
  kind: "review",
  source: "issue_comment",
  identifier: 502,
  entity: 30,
  pull: true,
  branch: "feature",
  head: sha("a"),
  ownerAuthored: true,
  fork: false,
  key: "issue_comment:502:x",
  task: "",
};
const workspace = { root: "/work", repository: "/work/repository", skills: "/work/skills" };

function stages(overrides: Partial<SessionRequest>) {
  return reviewStages({ config: sampleConfig(), request: { ...request, ...overrides }, workspace });
}

describe("session reviews", () => {
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
