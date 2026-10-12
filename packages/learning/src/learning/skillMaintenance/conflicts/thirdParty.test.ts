import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createLearningExecution } from "@shadowclone/agents";
import { skillEngineRun } from "@shadowclone/environment/testing";
import { listSkillProposals } from "@shadowclone/skills";
import { updateLearningEnvironment } from "../../environmentUpdate/update";
import { conflictFixture, forbiddenTable } from "../../testing";

const requiredChecklist = "Always include a dependency table in the release checklist.";
const catalogSchema = z.object({
  left: z.array(z.object({ token: z.string(), name: z.string() })),
  right: z.array(z.object({ token: z.string(), name: z.string() })),
});
const documentsSchema = z.object({ left: z.object({ document: z.string() }), right: z.object({ document: z.string() }) });

test("two third-party skills that disagree never become a conflict proposal", async () => {
  const setup = await conflictFixture();
  const checklistPath = path.join(setup.home, ".codex/plugins/cache/synthetic/other-publisher/1.0/skills/release-checklist/SKILL.md");
  await Bun.write(checklistPath, `---\nname: release-checklist\ndescription: Prepare a release checklist\n---\n\n${requiredChecklist}\n`);
  let conflictAssessments = 0;
  const execution = createLearningExecution({
    engine: "claude-code",
    limits: { maximumCalls: 20, maximumCostUsd: 2, timeoutMilliseconds: 300_000 },
    runner: async (run) => {
      const input: unknown = JSON.parse(run.prompt.split("\n\n").at(-1) ?? "{}");
      if (run.prompt.includes("Review skill catalog overlap")) {
        const catalog = catalogSchema.parse(input);
        const entries = [...catalog.left, ...catalog.right];
        const left = entries.find(({ name }) => name === "release-notes");
        const right = entries.find(({ name }) => name === "release-checklist");
        return skillEngineRun({ overlaps: left && right ? [{ left: left.token, right: right.token }] : [] });
      }
      conflictAssessments += 1;
      const documents = documentsSchema.parse(input);
      const passage = (document: string) => document.includes(forbiddenTable) ? forbiddenTable : requiredChecklist;
      return skillEngineRun({
        conflict: true, workflow: "Writing release notes",
        leftPassage: passage(documents.left.document), rightPassage: passage(documents.right.document),
        decision: "Decide whether release material includes a dependency table.",
      });
    },
  });
  try {
    await updateLearningEnvironment({ ...setup, execution });

    expect(conflictAssessments).toBe(0);
    expect(await listSkillProposals(setup.paths)).toEqual([]);
  } finally { await rm(setup.home, { recursive: true, force: true }); }
});
