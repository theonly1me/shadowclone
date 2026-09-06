import { expect, test } from "bun:test";
import { parseClaudeStream } from "./parseClaude";

test("parses a synthetic local command stream as an error", () => {
  const stream = [
    JSON.stringify({
      type: "system",
      subtype: "local_command",
      content:
        "<local-command-stdout>/plan isn't available in this environment.</local-command-stdout>",
    }),
    JSON.stringify({
      is_error: false,
      duration_api_ms: 0,
      num_turns: 0,
      total_cost_usd: 0,
      result: "/plan isn't available in this environment.",
      type: "result",
      duration_ms: 34,
      session_id: "test-session",
    }),
  ].join("\n");

  const run = parseClaudeStream({
    stream,
    fallbackSessionId: "fallback",
  });

  expect(run.isError).toBeTrue();
  expect(run.errorMessage).toBe("/plan isn't available in this environment.");
  expect(run.turns).toBe(0);
  expect(run.actions).toEqual([]);
});

test("parses an explicit Claude error result as an error", () => {
  const stream = JSON.stringify({
    type: "result",
    is_error: true,
    result: "API rate limit exceeded",
    num_turns: 0,
    session_id: "error-session",
  });

  const run = parseClaudeStream({
    stream,
    fallbackSessionId: "fallback",
  });

  expect(run.isError).toBeTrue();
  expect(run.errorMessage).toBe("API rate limit exceeded");
});

test("parses a stream with no result as an error", () => {
  const stream = JSON.stringify({
    type: "system",
    content: "starting process",
  });

  const run = parseClaudeStream({
    stream,
    fallbackSessionId: "fallback",
  });

  expect(run.isError).toBeTrue();
  expect(run.errorMessage).toBe("Claude returned no result");
});

test("parses budget exhausted errors array as errorMessage", () => {
  const stream = JSON.stringify({
    type: "result",
    is_error: true,
    subtype: "error_max_budget_usd",
    errors: ["Reached maximum budget ($0.20)"],
    terminal_reason: "budget_exhausted",
    num_turns: 1,
    session_id: "budget-session",
  });

  const run = parseClaudeStream({
    stream,
    fallbackSessionId: "fallback",
  });

  expect(run.isError).toBeTrue();
  expect(run.errorMessage).toBe("Reached maximum budget ($0.20)");
});
