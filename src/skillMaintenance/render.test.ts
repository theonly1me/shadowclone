import { expect, test } from "bun:test";
import { renderContextSkill } from "../integrations/markdown";
import { parseSkillDocument } from "./document";
import { fixtureSkill } from "./fixtures";
import { renderMaintainedSkill, restoreOriginalSkill } from "./render";

test("the integration skill has valid discoverable frontmatter and no unfinished scaffold", () => {
  const document = parseSkillDocument(renderContextSkill());
  expect(document.metadata.name).toBe("shadowclone-context");
  expect(document.metadata.description.length).toBeLessThan(1024);
  expect(document.metadata["disable-model-invocation"]).toBeUndefined();
  expect(document.body).not.toContain("[TODO:");
});

test("repeated maintenance preserves approved routing and original bytes for eval isolation", () => {
  const original = fixtureSkill();
  const first = renderMaintainedSkill({ original, description: "Apply typed changes when implementing features.", passages: ["Use complete names."] });
  const second = renderMaintainedSkill({ original: first, description: "", passages: ["Run focused tests after editing."] });
  expect(parseSkillDocument(second).metadata.description).toBe("Apply typed changes when implementing features.");
  expect(parseSkillDocument(second).metadata["disable-model-invocation"]).toBeTrue();
  expect(restoreOriginalSkill(second)).toBe(original);
});

test("mismatched code fences and duplicate metadata do not pass structural validation", () => {
  expect(() => parseSkillDocument(`${fixtureSkill()}\n\`\`\`ts\nconst value = 1;\n~~~\n`)).toThrow("unclosed");
  expect(() => parseSkillDocument(fixtureSkill().replace("name: typed-changes", "name: first\nname: second"))).toThrow();
});
