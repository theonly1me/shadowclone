import { expect, test } from "bun:test";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCursorAgent } from "./cursorAgent";

async function cursorFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "synthetic-cursor-"));
  const captured = path.join(directory, "captured.json");
  const stream = path.join(directory, "stream.jsonl");

  await Bun.write(stream, [
    JSON.stringify({ type: "system", subtype: "init", session_id: "cursor-review" }),
    JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "{\"findings\":[]}", session_id: "cursor-review" }),
  ].join("\n"));
  await Bun.write(
    path.join(directory, "cursor-agent"),
    `#!/bin/sh\nprintf '{"arguments":"%s","key":"%s","github":"%s","config":%s}' "$*" "$CURSOR_API_KEY" "$GH_TOKEN" "$(cat "$CURSOR_CONFIG_DIR/cli-config.json")" > '${captured}'\ncat '${stream}'\n`,
  );
  await chmod(path.join(directory, "cursor-agent"), 0o755);

  return { directory, captured, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

async function review(network: boolean) {
  const fixture = await cursorFixture();
  const previous = { path: process.env.PATH, key: process.env.CURSOR_API_KEY, github: process.env.GH_TOKEN };

  process.env.PATH = `${fixture.directory}:${previous.path}`;
  process.env.CURSOR_API_KEY = "synthetic-cursor-key";
  process.env.GH_TOKEN = "synthetic-github-token";

  try {
    const run = await runCursorAgent({
      prompt: "review",
      cwd: fixture.directory,
      execution: { purpose: "review", network },
      allowedTools: ["Read", "Grep", "Glob"],
      permissionMode: "dontAsk",
    });
    const captured: unknown = await Bun.file(fixture.captured).json();

    return { run, captured };
  } finally {
    process.env.PATH = previous.path;
    process.env.CURSOR_API_KEY = previous.key;
    process.env.GH_TOKEN = previous.github;
    await fixture.cleanup();
  }
}

test("a Cursor review runs in ask mode with the API key, denies commands and writes, and gets no GitHub token", async () => {
  const { run, captured } = await review(false);

  expect(run.text).toBe('{"findings":[]}');
  expect(captured).toMatchObject({
    arguments: expect.stringContaining("--mode ask"),
    key: "synthetic-cursor-key",
    github: "",
    config: {
      permissions: {
        allow: ["Read(**)"],
        deny: ["Shell(*)", "Write(**)", "Write(/**)", "Mcp(*:*)", "WebFetch(*)"],
      },
    },
  });
});

test("a Cursor review may fetch web pages only when the network is on", async () => {
  const { captured } = await review(true);

  expect(captured).toMatchObject({
    config: { permissions: { allow: ["Read(**)", "WebFetch(*)"], deny: ["Shell(*)", "Write(**)", "Write(/**)", "Mcp(*:*)"] } },
  });
});

test("Cursor still refuses a tool allowlist outside a review", async () => {
  await expect(runCursorAgent({
    prompt: "task",
    cwd: "/synthetic",
    execution: { purpose: "evaluation" },
    allowedTools: ["Read"],
    permissionMode: "dontAsk",
  })).rejects.toThrow("Cursor cannot enforce a granular tool allowlist");
});
