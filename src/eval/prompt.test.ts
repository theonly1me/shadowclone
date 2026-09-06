import { expect, test } from "bun:test";
import { extractPromptText } from "./prompt";

test("extracts plain text strings unchanged", () => {
  const result = extractPromptText("fix the failing test");
  expect(result).toBe("fix the failing test");
});

test("extracts prompt from Antigravity user input with USER_REQUEST tags", () => {
  const raw = JSON.stringify({
    step_index: 0,
    source: "USER_EXPLICIT",
    type: "USER_INPUT",
    status: "DONE",
    created_at: "2026-09-06T08:43:48Z",
    content: "<USER_REQUEST>\n/plan Fix the bug in auth.ts\n</USER_REQUEST>",
  });
  const result = extractPromptText(raw);
  expect(result).toBe("/plan Fix the bug in auth.ts");
});

test("extracts prompt from Antigravity user input without USER_REQUEST tags", () => {
  const raw = JSON.stringify({
    step_index: 0,
    source: "USER_EXPLICIT",
    type: "USER_INPUT",
    content: "run the migrations",
  });
  const result = extractPromptText(raw);
  expect(result).toBe("run the migrations");
});

test("extracts prompt from Claude Code user message object", () => {
  const raw = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: "refactor the distillation loop",
    },
  });
  const result = extractPromptText(raw);
  expect(result).toBe("refactor the distillation loop");
});

test("extracts prompt from Claude Code content blocks", () => {
  const raw = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "text", text: "explain this function" }],
    },
  });
  const result = extractPromptText(raw);
  expect(result).toBe("explain this function");
});

test("extracts prompt from Cursor content array", () => {
  const raw = JSON.stringify({
    role: "user",
    content: [{ type: "text", text: "inspect the sqlite store" }],
  });
  const result = extractPromptText(raw);
  expect(result).toBe("inspect the sqlite store");
});

test("returns null for empty or whitespace prompts", () => {
  expect(extractPromptText("")).toBeNull();
  expect(extractPromptText("   \n\t  ")).toBeNull();
  expect(
    extractPromptText(
      JSON.stringify({ content: "<USER_REQUEST>\n\n</USER_REQUEST>" }),
    ),
  ).toBeNull();
});

test("returns null when content array has no text block", () => {
  const raw = JSON.stringify({
    role: "user",
    content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }],
  });
  expect(extractPromptText(raw)).toBeNull();
});
