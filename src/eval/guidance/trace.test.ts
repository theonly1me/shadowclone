import { expect, test } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseClaudeStream } from "../../engine/parseClaude";
import type { EngineAction } from "../../engine";
import { guidanceFixture } from "./fixtures";
import { deliveryTrace, summarizeDelivery } from "./trace";

function trace(actions: readonly EngineAction[]) {
  const [scenario] = guidanceFixture().scenarios;

  if (!scenario) {
    throw new Error("Scenario missing");
  }

  return deliveryTrace({ directory: "/snapshot", scenario, actions });
}

const read: EngineAction = {
  tool: "Read",
  path: "/snapshot/skills/clean-code/SKILL.md",
  succeeded: true,
  requestSequence: 3,
  resultSequence: 4,
};

test("canonical aliases count identically and symlinks outside the snapshot do not count", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "trace-alias-"));

  try {
    const [scenario] = guidanceFixture().scenarios;

    if (!scenario) {
      throw new Error("Scenario missing");
    }

    await Bun.write(
      path.join(directory, "real/skills/clean-code/SKILL.md"),
      "Synthetic skill",
    );
    await symlink(path.join(directory, "real"), path.join(directory, "alias"));
    await symlink(path.join(directory, "real"), path.join(directory, "other"));

    const action = {
      ...read,
      path: path.join(directory, "real/skills/clean-code/SKILL.md"),
    };
    const result = deliveryTrace({
      directory: path.join(directory, "alias"),
      scenario,
      actions: [action],
    });

    expect(result.requiredSkills[0]).toEqual({
      name: "clean-code",
      loaded: true,
      beforeEdit: true,
    });

    const escaped = deliveryTrace({
      directory: path.join(directory, "real/skills"),
      scenario,
      actions: [{ ...read, path: path.join(directory, "other/SKILL.md") }],
    });

    expect(escaped.reads).toEqual([]);
    expect(escaped.actions[0]?.path).toBeNull();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed writes and a read-only version command are not edits", () => {
  for (const preceding of [
    { tool: "Write", path: "/snapshot/file.ts", succeeded: false },
    { tool: "Bash", path: null, command: "node --version", succeeded: true },
    { tool: "Bash", path: null, command: "bun --version", succeeded: true },
  ]) {
    expect(
      trace([{ ...preceding, requestSequence: 1, resultSequence: 2 }, read])
        .reads[0]?.beforeEdit,
    ).toBeTrue();
  }
});

test("unclassified shell activity or missing event positions make timing unknown", () => {
  expect(
    trace([
      {
        tool: "Bash",
        path: null,
        command: "some-command private-argument",
        succeeded: true,
        requestSequence: 1,
        resultSequence: 2,
      },
      read,
    ]).reads[0]?.beforeEdit,
  ).toBeNull();
  expect(
    trace([{ ...read, resultSequence: null }]).reads[0]?.beforeEdit,
  ).toBeNull();
  expect(
    trace([{ tool: "Write", path: "/snapshot/file.ts", succeeded: null }, read])
      .reads[0]?.beforeEdit,
  ).toBeNull();
  expect(
    trace([
      { ...read, succeeded: false },
      { ...read, succeeded: null },
    ]).reads,
  ).toEqual([]);
});

test("a result arriving after a mutation request is not a before-edit read", () => {
  const stream = [
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "read",
            name: "Read",
            input: { file_path: read.path },
          },
          {
            type: "tool_use",
            id: "write",
            name: "Write",
            input: { file_path: "/snapshot/file.ts" },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "read",
            content: "private skill body",
          },
          { type: "tool_result", tool_use_id: "write", content: "written" },
        ],
      },
    },
  ]
    .map((record) => JSON.stringify(record))
    .join("\n");

  const parsed = parseClaudeStream({ stream, fallbackSessionId: "synthetic" });

  expect(parsed.actions[0]?.requestSequence).toBe(1);
  expect(parsed.actions[0]?.resultSequence).toBe(3);
  expect(trace(parsed.actions).reads[0]?.beforeEdit).toBeFalse();
  expect(JSON.stringify(parsed.actions)).not.toContain("private skill body");
});

test("persisted normalized metadata reproduces delivery without retaining commands", () => {
  const result = trace([
    read,
    {
      tool: "Bash",
      path: null,
      command: "private-command-body",
      succeeded: true,
      requestSequence: 5,
      resultSequence: 6,
    },
  ]);

  const [scenario] = guidanceFixture().scenarios;

  if (!scenario) {
    throw new Error("Scenario missing");
  }

  expect(
    summarizeDelivery({ actions: result.actions, scenario }).reads,
  ).toEqual(result.reads);
  expect(JSON.stringify(result)).not.toContain("private-command-body");
  expect(result.measurementVersion).toBe(2);
});
