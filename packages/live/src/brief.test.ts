import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { LiveBrief } from "./brief";
import type { LiveRecord } from "./record";
import { liveBriefLines, liveBriefListLine } from "./text";

const record: LiveRecord = {
  id: "live-0000000a",
  engine: "claude",
  repository: "you/app",
  branch: "fix/parser",
  folder: "app",
  state: "idle",
  startedAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:05:00.000Z",
  summary: "Renamed it. Keep the old name?",
  attention: null,
  surface: null,
};

const brief: LiveBrief = {
  name: "Rename the parser",
  goal: "The owner wants the parser renamed.",
  done: "The agent renamed it.",
  kind: "question",
  question: "Keep the old name?",
  options: ["Keep it", "Remove it"],
  messageDigest: createHash("sha256").update(record.summary).digest("hex"),
  writtenAt: "2026-11-10T12:05:01.000Z",
};

const prefix = "live-0000000a idle claude you/app fix/parser 2026-11-10T12:05:00.000Z";

describe("a brief next to its session", () => {
  test("an idle session whose last message made the brief shows the kind and the question", () => {
    expect(liveBriefListLine({ record, brief })).toBe(
      `${prefix} [question] Rename the parser: Renamed it. Keep the old name?`,
    );
    expect(liveBriefLines({ record, brief })).toEqual([
      "Brief, a summary by a model at 2026-11-10T12:05:01.000Z:",
      "Name: Rename the parser",
      "Kind: question",
      "Goal: The owner wants the parser renamed.",
      "Done: The agent renamed it.",
      "Question: Keep the old name?",
      "Option 1: Keep it",
      "Option 2: Remove it",
    ]);
  });

  test("a working session shows no kind and no question", () => {
    const working: LiveRecord = { ...record, state: "working" };

    expect(liveBriefListLine({ record: working, brief })).toBe(
      "live-0000000a working claude you/app fix/parser 2026-11-10T12:05:00.000Z Rename the parser: Renamed it. Keep the old name?",
    );
    expect(liveBriefLines({ record: working, brief })).toEqual([
      "Brief, a summary by a model at 2026-11-10T12:05:01.000Z, of an earlier message:",
      "Name: Rename the parser",
      "Goal: The owner wants the parser renamed.",
    ]);
  });

  test("an idle session with a newer last message shows no kind", () => {
    const newer: LiveRecord = { ...record, summary: "Done. The tests pass." };

    expect(liveBriefListLine({ record: newer, brief })).toBe(
      `${prefix} Rename the parser: Done. The tests pass.`,
    );
    expect(liveBriefLines({ record: newer, brief }).join("\n")).not.toContain("question");
  });
});
