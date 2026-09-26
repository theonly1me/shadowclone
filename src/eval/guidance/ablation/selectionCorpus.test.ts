import { expect, test } from "bun:test";
import { renderReference } from "../../../references/format";
import { renderSkillCatalog } from "../../transfer/skillCatalog";
import { frozenSelectionCorpus } from "./selectionCorpus";
import { selectTaskGuidance } from "./selector";

test("frozen corpus indexes whole rules without reference catalogs or duplicate skill instructions", () => {
  const profile = "# Shadowclone profile\n\n## Load skills first\n\nLoad relevant skills before editing.\n\n## Database rule\n\nKeep database transactions atomic.\n\nGuidance source: user\nApplies when: database schema\n\n## Existing skill rule\n\nAvoid unsafe casting.\n\nReference `unrelated`: Unrelated catalog item.\n";
  const skills = [{ relativePath: "skills/clean-code/SKILL.md", content: "---\nname: clean-code\ndescription: Always load first.\n---\nAvoid unsafe casting." }];
  const catalog = renderSkillCatalog(skills);
  const corpus = frozenSelectionCorpus({ profile, references: [], skills });
  expect(corpus).toHaveLength(3);
  expect(corpus[0]?.excluded).toBe("skill-routing");
  expect(corpus[1]?.applicability).toEqual(["database schema"]);
  expect(corpus[2]?.excluded).toBe("skill-covered");
  const result = selectTaskGuidance({ taskText: "database transactions", corpus });
  expect(result.packet).toBe("## Database rule\n\nKeep database transactions atomic.\n\nGuidance source: user\nApplies when: database schema");
  expect(result.packet).not.toContain("Reference `");
  expect(result.packet).not.toContain("Load skills");
  expect(renderSkillCatalog(skills)).toBe(catalog);
});

test("reference bodies are indexed but only summaries and retrieval paths are delivered", () => {
  const content = renderReference({ schema: 1, key: "deploy-lock", title: "Deployment lock", summary: "Keep lock during deployment.", tags: ["kubernetes", "rollout"], scope: "global", originDirectory: null, repositoryName: null, source: "user", sourceLocator: "fixture/deployment", updatedAt: "2026-09-21", body: "Detailed deployment locking recovery instructions." });
  const corpus = frozenSelectionCorpus({ profile: "# Profile", references: [{ relativePath: "references/deploy-lock.md", content }], skills: [] });
  const result = selectTaskGuidance({ taskText: "deployment locking", corpus });
  expect(result.selectedIds).toEqual(["reference/deploy-lock"]);
  expect(result.packet).toContain("Read: .eval-context/references/deploy-lock.md");
  expect(result.packet).not.toContain("Detailed");
  expect(() => frozenSelectionCorpus({ profile: "# Profile", references: [{ relativePath: "references/../../escape.md", content }], skills: [] })).toThrow("invalid");
});
