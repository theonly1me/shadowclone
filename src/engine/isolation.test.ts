import { expect, test } from "bun:test";
import { buildClaudeArguments } from "./claudeCode";

test("dispatch loads no host settings, hooks, or MCP servers", () => {
  const arguments_ = buildClaudeArguments({
    sessionId: "00000000-0000-4000-8000-000000000000",
    run: {
      prompt: "private prompt",
      cwd: "/worktree",
      execution: { purpose: "dispatch" },
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

test("dispatch opens only the domains a granted action needs", () => {
  const arguments_ = buildClaudeArguments({
    sessionId: "00000000-0000-4000-8000-000000000000",
    run: {
      prompt: "private prompt",
      cwd: "/worktree",
      execution: {
        purpose: "dispatch",
        allowedDomains: ["github.com", "api.github.com"],
      },
      allowedTools: ["Bash(gh pr comment:*)"],
      permissionMode: "dontAsk",
    },
  });

  const settingsIndex = arguments_.indexOf("--settings");
  const settings = arguments_[settingsIndex + 1] ?? "";
  expect(settings).toContain('"allowedDomains":["github.com","api.github.com"]');
  expect(settings).toContain('"allowLocalBinding":false');
});
