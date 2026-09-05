import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig } from "../config";
import { createProjectPaths } from "../paths";
import { resolveRedacted } from "../redact";
import { observeAll } from "./index";
import type { AgentEvent } from "./types";

const plantedSecret = "sk-proj-abc123DEF456ghi789JKL";

async function createClaudeFixture(): Promise<{
  readonly homeDirectory: string;
  readonly sourcePath: string;
}> {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-observe-"),
  );
  const projectsDirectory = path.join(
    homeDirectory,
    ".claude",
    "projects",
    "fixture",
  );
  await mkdir(projectsDirectory, { recursive: true });
  const sourcePath = path.join(projectsDirectory, "session-1.jsonl");
  const records = [
    {
      type: "user",
      sessionId: "session-1",
      uuid: "user-1",
      timestamp: "2026-09-05T08:00:00.000Z",
      cwd: "/repo",
      message: { id: "message-1", content: `use ${plantedSecret}` },
    },
    {
      type: "assistant",
      sessionId: "session-1",
      uuid: "assistant-1",
      requestId: "request-1",
      message: {
        id: "message-2",
        content: [{ type: "tool_use", id: "tool-1", name: "Read" }],
      },
    },
    {
      type: "user",
      sessionId: "session-1",
      uuid: "result-1",
      message: {
        id: "message-3",
        content: [{ type: "tool_result", content: "private customer row" }],
      },
    },
  ];
  await Bun.write(
    sourcePath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  return { homeDirectory, sourcePath };
}

test("keeps captured text behind resolveRedacted", async () => {
  const fixture = await createClaudeFixture();
  const paths = createProjectPaths({
    homeDirectory: fixture.homeDirectory,
    platform: "darwin",
  });
  const config = {
    ...defaultConfig,
    sources: { ...defaultConfig.sources, "claude-code": true },
  };
  const events: AgentEvent[] = [];

  for await (const batch of observeAll({
    config,
    paths,
    getCursor: () => null,
  })) {
    events.push(...batch.events);
  }

  const prompt = events.find((event) => event.kind === "user-prompt");
  expect(prompt?.textRef).not.toBeNull();
  const text = prompt?.textRef
    ? await resolveRedacted({ ref: prompt.textRef })
    : "";
  expect(text).not.toContain(plantedSecret);
  expect(text).toContain("[redacted:llm-api-key]");

  const toolResult = events.find((event) => event.kind === "tool-result");
  expect(toolResult?.textRef).toBeNull();
});

test("does not touch paths for disabled sources", async () => {
  const paths = createProjectPaths({
    homeDirectory: "/path/that/must/not/be/read",
    platform: "linux",
  });
  let cursorLookups = 0;

  for await (const batch of observeAll({
    config: defaultConfig,
    paths,
    getCursor: () => {
      cursorLookups += 1;
      return null;
    },
  })) {
    expect(batch).toBeUndefined();
  }

  expect(cursorLookups).toBe(0);
});
