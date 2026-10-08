import path from "node:path";
import { z } from "zod";
import { reviewTools } from "../engine/execution";
import type { EngineRunner, ReasoningEffort } from "../engine/types";
import { redactSecrets } from "../redact";
import { seedSkillsDirectory } from "../skills/library";
import { reviewPrompt, type ReviewPacket } from "./packet";
import { analysisSchema, type Finding } from "./types";

export type ReviewModel = {
  readonly runner: EngineRunner;
  readonly model: string;
  readonly effort: ReasoningEffort;
};

export type Analysis = {
  readonly findings: readonly Finding[];
  readonly costUsd: number | null;
};

export async function readReviewSkill(): Promise<string> {
  const text = await Bun.file(path.join(await seedSkillsDirectory(), "shadowclone-review", "SKILL.md")).text();
  const body = /^---\n[\s\S]*?\n---\n([\s\S]*)$/.exec(text)?.[1];

  if (body === undefined) {
    throw new Error("The bundled shadowclone-review skill is missing its frontmatter");
  }

  return body.trim();
}

export async function analyzeReview(options: {
  readonly reviewModel: ReviewModel;
  readonly checkout: string;
  readonly packet: ReviewPacket;
  readonly skill: string;
}): Promise<Analysis> {
  const run = await options.reviewModel.runner({
    prompt: reviewPrompt({ skill: options.skill, packet: options.packet }),
    cwd: options.checkout,
    execution: { purpose: "review" },
    allowedTools: reviewTools,
    permissionMode: "dontAsk",
    model: options.reviewModel.model,
    reasoningEffort: options.reviewModel.effort,
    outputSchema: z.toJSONSchema(analysisSchema, { target: "draft-7" }),
  });

  if (run.isError) {
    const reason = redactSecrets({ text: run.errorMessage ?? "No diagnostic was returned." });

    throw new Error(`The review run failed: ${reason.slice(0, 600)}`);
  }

  return {
    findings: analysisSchema.parse(run.structured ?? JSON.parse(run.text)).findings,
    costUsd: run.costUsd,
  };
}
