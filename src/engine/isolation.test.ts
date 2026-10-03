import { expect, test } from "bun:test";
import { buildClaudeArguments } from "./claudeCode";

test("a tool-using run loads no host settings, hooks, or MCP servers and opens no domains", () => {
  const arguments_ = buildClaudeArguments({
    sessionId: "00000000-0000-4000-8000-000000000000",
    run: {
      prompt: "private prompt",
      cwd: "/worktree",
      execution: { purpose: "evaluation" },
      systemPromptFile: "/profile.md",
      allowedTools: ["Edit"],
      permissionMode: "dontAsk",
    },
  });

  const settingSourcesIndex = arguments_.indexOf("--setting-sources");

  expect(arguments_[settingSourcesIndex + 1]).toBe("");
  expect(arguments_).toContain("--strict-mcp-config");
  expect(arguments_).toContain('{"mcpServers":{}}');
  expect(arguments_).toContain("--safe-mode");

  const settingsIndex = arguments_.indexOf("--settings");
  const settings = arguments_[settingsIndex + 1] ?? "";

  expect(settings).toContain('"disableAllHooks":true');
  expect(settings).toContain('"failIfUnavailable":true');
  expect(settings).toContain('"allowUnsandboxedCommands":false');
  expect(settings).toContain('"allowedDomains":[]');
});
