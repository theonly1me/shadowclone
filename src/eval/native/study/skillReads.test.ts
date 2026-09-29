import { expect, test } from "bun:test";
import { observedSkillReads } from "./skillReads";

test("credits only successful direct reads of an expected skill", () => {
  const skillPath = "/private/tmp/run/home/.agents/skills/names/SKILL.md";
  const item = (command: string, exitCode: number) => JSON.stringify({
    type: "item.completed", item: { item_type: "command_execution", status: "completed",
      command, exit_code: exitCode },
  });
  const stream = [
    item(`/bin/zsh -lc "cat '${skillPath}'"`, 0),
    item(`/bin/zsh -lc "echo cat '${skillPath}'"`, 0),
    item(`/bin/zsh -lc "cat '${skillPath}'"`, 1),
  ].join("\n");
  expect(observedSkillReads({ stream, skillPaths: { names: skillPath } })).toEqual(["names"]);
});

test("leaves ambiguous shell pipelines uncredited", () => {
  const skillPath = "/private/tmp/run/home/.agents/skills/names/SKILL.md";
  const stream = JSON.stringify({ type: "item.completed", item: {
    item_type: "command_execution", status: "completed", exit_code: 0,
    command: `/bin/zsh -lc "cat '${skillPath}' | head"`,
  } });
  expect(observedSkillReads({ stream, skillPaths: { names: skillPath } })).toEqual([]);
});

test("credits Claude skill invocations and direct reads of any copy of a skill", async () => {
  const { claudeSkillReads } = await import("./skillReads");
  const locations = { "home:names": ["/h/.agents/skills/names/SKILL.md", "/h/.claude/skills/names/SKILL.md"], "home:review": ["/h/.claude/skills/review/SKILL.md"] };
  expect(claudeSkillReads({ locations, actions: [
    { tool: "Skill", path: null, command: "names" },
    { tool: "Read", path: "/h/.claude/skills/review/SKILL.md", command: null },
    { tool: "Read", path: "/h/.claude/skills/other/SKILL.md", command: null },
  ] })).toEqual(["home:names", "home:review"]);
  expect(claudeSkillReads({ locations, actions: [{ tool: "Bash", path: null, command: "cat /h/.agents/skills/names/SKILL.md" }] })).toEqual([]);
});
