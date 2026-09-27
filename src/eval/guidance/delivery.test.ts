import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contextFiles, installGuidanceContext } from "./context";
import { guidanceFixture } from "./fixtures";
import { validateScenarios } from "./prepare";
import { deliveryTrace } from "./trace";

test("conditions share skills but never share the two memory stores", () => {
  const suite = guidanceFixture();

  expect(contextFiles({ suite, arm: "bare" })).toEqual([]);
  expect(contextFiles({ suite, arm: "skills" })).toEqual(suite.context);
  expect(contextFiles({ suite, arm: "memory" })).toEqual([
    ...suite.context,
    ...suite.memory,
  ]);
  expect(contextFiles({ suite, arm: "clone" })).toEqual([
    ...suite.context,
    ...suite.references,
  ]);
  expect(() =>
    validateScenarios({
      ...suite,
      context: [...suite.context, ...suite.memory],
    }),
  ).toThrow("wrong condition");
});

test("installs full reference bodies only for clone and does not inject skill bodies", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guidance-delivery-"));

  try {
    const suite = guidanceFixture();
    const prompt = await installGuidanceContext({
      suite,
      arm: "clone",
      directory,
    });

    expect(prompt).toContain(suite.profile);
    expect(prompt).toContain("Mandatory before edits.");
    expect(prompt).not.toContain("Use complete names.");
    expect(
      await Bun.file(
        path.join(directory, ".eval-context/references/reference_queue.md"),
      ).text(),
    ).toBe("Queue retries use a separate budget.");
    expect(
      await Bun.file(
        path.join(directory, ".eval-context/memory/MEMORY.md"),
      ).exists(),
    ).toBeFalse();
    await expect(
      installGuidanceContext({
        directory,
        arm: "clone",
        suite: {
          ...suite,
          references: [{ relativePath: "../outside.md", content: "escape" }],
        },
      }),
    ).rejects.toThrow("escapes");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("current guidance offers references only after an explicit index read", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "guidance-current-delivery-"),
  );

  try {
    const suite = { ...guidanceFixture(), protocol: "guidance-v2" as const };
    const prompt = await installGuidanceContext({
      suite,
      arm: "clone",
      directory,
    });

    expect(prompt).toContain(".eval-context/reference-index.md");
    expect(prompt).not.toContain(".eval-context/references/reference_queue.md");
    expect(
      await Bun.file(
        path.join(directory, ".eval-context/reference-index.md"),
      ).text(),
    ).toContain("references/reference_queue.md");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("only successful reads count and loading after an edit is distinguished", () => {
  const [scenario] = guidanceFixture().scenarios;

  if (!scenario) {
    throw new Error("Fixture scenario missing");
  }

  const trace = deliveryTrace({
    directory: "/snapshot",
    scenario,
    actions: [
      {
        tool: "Read",
        path: "/snapshot/.eval-context/skills/0/clean-code/SKILL.md",
        succeeded: false,
      },
      {
        tool: "Write",
        path: "/snapshot/code.ts",
        succeeded: true,
        requestSequence: 2,
        resultSequence: 3,
      },
      {
        tool: "Read",
        path: "/snapshot/.eval-context/skills/0/clean-code/SKILL.md",
        succeeded: true,
        requestSequence: 4,
        resultSequence: 5,
      },
      { tool: "Read", path: "/outside/SKILL.md", succeeded: true },
    ],
  });

  expect(trace.reads).toHaveLength(1);
  expect(trace.requiredSkills).toEqual([
    { name: "clean-code", loaded: true, beforeEdit: false },
  ]);
});

test("scenario validation rejects source-free grades and hidden missing skills", () => {
  const suite = guidanceFixture();

  expect(() => validateScenarios(suite)).not.toThrow();
  expect(() => validateScenarios({ ...suite, context: [] })).toThrow(
    "source quotation",
  );
  expect(() =>
    validateScenarios({
      ...suite,
      scenarios: suite.scenarios.map((scenario) => ({
        ...scenario,
        expectedSkills: ["missing"],
      })),
    }),
  ).toThrow("Expected skill");
});
