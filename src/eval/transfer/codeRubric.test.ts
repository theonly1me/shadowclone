import { expect, test } from "bun:test";
import { compileCodeRubric } from "./codeRubric";

const optionsRule = "Two or more arguments take a single options object, never positional. This applies to internal helpers too.";
const commentsRule = "Write zero comments. Zero exceptions, including JSDoc.";

test("freezes exact code rules independently of skill filenames and excludes workflow and examples", () => {
  const source = {
    relativePath: "skills/0/engineering/SKILL.md",
    content: ["# Engineering", "## Code", optionsRule, "", commentsRule, "", "## Workflow", "Commit after every change.", "", "```ts", "Write zero comments in this explanatory example.", "```"].join("\n"),
  };
  const rubric = compileCodeRubric([source, { ...source, relativePath: "skills/1/copy/SKILL.md" },
    { relativePath: "profile.md", content: "Write zero comments unless an explanation is useful." }]);
  expect(rubric.map((check) => check.requirement)).toEqual([optionsRule, commentsRule]);
  expect(rubric.map((check) => check.rubric?.id)).toEqual(["options-object", "zero-comments"]);
  expect(rubric.every((check) => check.rubric?.version === 2 && check.source.relativePath === source.relativePath)).toBeTrue();
  expect(rubric[0]?.rubric?.override).toContain("does not exempt internal helpers");
});

test("source edits change rubric identity without changing the criterion ID", () => {
  const source = { relativePath: "profile.md", content: commentsRule };
  const [original] = compileCodeRubric([source]);
  const [changed] = compileCodeRubric([{ ...source, content: `${commentsRule} Tests included.` }]);
  expect(original?.rubric?.id).toBe(changed?.rubric?.id);
  expect(original?.rubric?.fingerprint).not.toBe(changed?.rubric?.fingerprint);
});
