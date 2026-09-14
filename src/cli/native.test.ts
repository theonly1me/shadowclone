import { expect, test } from "bun:test";
import { parseNativeOptions } from "./native";

test("native installation defaults to personal Claude guidance", () => {
  expect(parseNativeOptions([])).toEqual({
    agents: ["claude-code"],
    scope: "global",
    subagent: false,
    autoDelegate: false,
  });
});

test("all installs every supported main-agent adapter", () => {
  expect(parseNativeOptions(["--agent", "all"])?.agents).toEqual([
    "claude-code",
    "codex",
    "cursor",
    "antigravity",
  ]);
});

test("subagents remain an explicit repository Claude option", () => {
  expect(parseNativeOptions(["--subagent"])).toBeNull();
  expect(
    parseNativeOptions(["--repo", "--agent", "codex", "--subagent"]),
  ).toBeNull();
  expect(
    parseNativeOptions(["--repo", "--subagent"]),
  ).toMatchObject({
    agents: ["claude-code"],
    scope: "repository",
    subagent: true,
  });
});
