import path from "node:path";
import { z } from "zod";
import { createLearningExecution } from "../../engine";
import { emptyEnvironment } from "../../environment/types";
import { writeEnvironment } from "../../environment/store";
import { skillEngineRun, skillFixture } from "../fixtures";

export const requiredTable = "Include a dependency table in release notes.";
export const forbiddenTable = "Never include a dependency table in release notes.";
export const syntheticSecret = ["sk", "proj", "abcdefghijklmnopqrstuvwxyz0123456789"].join("-");

export async function conflictFixture() {
  const setup = await skillFixture();
  const personal = `---\nname: typed-changes\ndescription: Prepare release notes\n---\n\n${requiredTable}\n\nToken: ${syntheticSecret}\n`;
  const thirdParty = `---\nname: release-notes\ndescription: Write release notes\n---\n\n${forbiddenTable}\n`;
  const thirdPartyPath = path.join(setup.home, ".codex/plugins/cache/synthetic/publisher/1.0/skills/release-notes/SKILL.md");

  await Bun.write(setup.filePath, personal);
  await Bun.write(thirdPartyPath, thirdParty);
  await writeEnvironment({ paths: setup.paths, state: { ...emptyEnvironment, phase: "active", automatic: true } });

  return { ...setup, personal, thirdParty, thirdPartyPath };
}

const catalogSchema = z.object({
  left: z.array(z.object({ token: z.string(), name: z.string() })),
  right: z.array(z.object({ token: z.string(), name: z.string() })),
});
const documentsSchema = z.object({
  left: z.object({ document: z.string() }),
  right: z.object({ document: z.string() }),
});

export function conflictExecution(options: {
  readonly maximumCalls?: number;
  readonly fabricatedPassage?: boolean;
  readonly onPrompt?: (prompt: string) => void;
} = {}) {
  return createLearningExecution({
    engine: "claude-code",
    limits: { maximumCalls: options.maximumCalls ?? 20, maximumCostUsd: 2, timeoutMilliseconds: 300_000 },
    runner: async (run) => {
      options.onPrompt?.(run.prompt);
      const input: unknown = JSON.parse(run.prompt.split("\n\n").at(-1) ?? "{}");

      if (run.prompt.includes("Review skill catalog overlap")) {
        const catalog = catalogSchema.parse(input);
        const left = catalog.left.find(({ name }) => name === "typed-changes");
        const right = catalog.right.find(({ name }) => name === "release-notes");
        if (!left || !right) throw new Error("Expected both synthetic workflows");

        return skillEngineRun({ overlaps: [{ left: left.token, right: right.token }] });
      }

      const documents = documentsSchema.parse(input);
      const passage = (document: string) => document.includes(forbiddenTable) ? forbiddenTable : requiredTable;

      return skillEngineRun({
        conflict: true,
        workflow: "Writing release notes",
        leftPassage: options.fabricatedPassage ? "Invented guidance" : passage(documents.left.document),
        rightPassage: passage(documents.right.document),
        decision: "Decide whether dependency tables belong in release notes and update the owning instructions.",
      });
    },
  });
}
