import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readAskedQuestions } from "./questions";
import { askResponse, askedText } from "./server";

function call(argumentsValue: unknown): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "shadowclone_ask", arguments: argumentsValue },
  });
}

describe("the ask tool inside a clone", () => {
  test("a question goes to the questions file, and the tool tells the agent to keep working", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-ask-"));
    const file = path.join(root, "questions.jsonl");

    try {
      const response = await askResponse({
        line: call({ question: "Delete the old API?", options: ["yes", "no"], recommended: "no" }),
        file,
      });

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 3,
        result: { content: [{ type: "text", text: askedText }], isError: false },
      });
      expect(await readAskedQuestions(file)).toEqual([
        {
          id: expect.stringMatching(/^q[a-z0-9]{6}$/),
          text: "Delete the old API?",
          options: ["yes", "no"],
          recommended: "no",
        },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a call with no recommended option is refused and asks nothing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-ask-"));
    const file = path.join(root, "questions.jsonl");

    try {
      const response = await askResponse({ line: call({ question: "Delete it?" }), file });

      expect(JSON.stringify(response)).toContain('"isError":true');
      expect(await readAskedQuestions(file)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
