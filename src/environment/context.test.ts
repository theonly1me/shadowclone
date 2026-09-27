import { expect, test } from "bun:test";
import { emptyEnvironment } from "./types";
import { renderSkillRouting } from "./context";

const globalScope = {
  key: "global",
  directory: "/home/synthetic",
  repository: null,
};

const baseline = {
  filePath: "/home/synthetic/.agents/skills/shadowclone-baseline/SKILL.md",
  fingerprint: "hash",
  original: null,
  kind: "skill" as const,
  scope: "global",
  name: "shadowclone-baseline",
  description: "Always load",
  learningKeys: ["style"],
};

test("startup routes to skills without inlining learned behavior or other repository facts", () => {
  const text = renderSkillRouting({
    scopes: [globalScope],
    state: {
      ...emptyEnvironment,
      artifacts: [baseline],
      facts: [
        {
          scope: "another-repository",
          text: "Restricted repository detail",
          learningKeys: ["fact"],
        },
      ],
    },
  });

  expect(text).toContain("Before every task");
  expect(text).toContain(baseline.filePath);
  expect(text).not.toContain("Restricted repository detail");
  expect(text).not.toContain("profile");
});

test("routing overflow is explicit and never drops a fact", () => {
  expect(() =>
    renderSkillRouting({
      scopes: [globalScope],
      state: {
        ...emptyEnvironment,
        facts: [
          { scope: "global", text: "x".repeat(4096), learningKeys: ["fact"] },
        ],
      },
    }),
  ).toThrow("4 KiB");
});
