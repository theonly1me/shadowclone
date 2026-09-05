import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getRecentShellHistory } from "./collector";

async function writeHistoryFile(contents: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-"));
  const historyPath = path.join(directory, ".zsh_history");
  await writeFile(historyPath, contents);

  return historyPath;
}

test("redacts secrets before returning captured history", async () => {
  const historyPath = await writeHistoryFile(
    ["git status", "export OPENAI_API_KEY=sk-proj-abc123DEF456ghi789JKL", "bun test"].join("\n"),
  );

  const history = await getRecentShellHistory({ lineCount: 100, historyPaths: [historyPath] });

  expect(history).not.toContain("sk-proj-abc123DEF456ghi789JKL");
  expect(history).toContain("[redacted:llm-api-key]");
  expect(history).toContain("git status");
});

test("keeps only the most recent lines", async () => {
  const historyPath = await writeHistoryFile(["one", "two", "three", "four"].join("\n"));

  const history = await getRecentShellHistory({ lineCount: 2, historyPaths: [historyPath] });

  expect(history.trim()).toBe("three\nfour");
});

test("returns an empty string when no history file exists", async () => {
  const history = await getRecentShellHistory({
    lineCount: 100,
    historyPaths: ["/nonexistent/shadowclone/.zsh_history"],
  });

  expect(history.trim()).toBe("");
});
