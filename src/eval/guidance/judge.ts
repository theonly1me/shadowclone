import { structuredValue } from "../transfer/structured";
import type { ModelCall } from "../transfer/types";
import type { GuidanceCheck, GuidanceResult, GuidanceScenario } from "./schema";
import { judgmentSchema, judgmentOutputSchema } from "./judgeSchema";
import { type JudgePacket, validateJudgePacket } from "./judgeEvidence";
import {
  judgeInstructions,
  groundedJudgeInstructions,
  sourceJudgeInstructions,
  adherenceJudgeInstructions,
  sourceJudgePromptFingerprint,
} from "./judgePrompt";
import { validateSourcePacket } from "./sourceEvidence";
import type { SourceJudging } from "./sourceEvidenceSchema";

export async function judgeGuidance(options: {
  readonly scenario: GuidanceScenario;
  readonly candidate: GuidanceResult;
  readonly vote: number;
  readonly cwd: string;
  readonly call: ModelCall;
  readonly packet?: JudgePacket;
  readonly sourceJudging?: SourceJudging;
}): Promise<GuidanceCheck[]> {
  const criteria = options.scenario.criteria.filter(
    (criterion) => criterion.check === "judged",
  );

  if (criteria.length === 0) {
    return [];
  }

  if (options.packet) {
    validateJudgePacket(options.packet);
  }

  if (options.sourceJudging) {
    validateSourcePacket(options.sourceJudging.packet);
  }

  if (
    options.sourceJudging &&
    options.sourceJudging.promptFingerprint !==
      sourceJudgePromptFingerprint(options.sourceJudging.version)
  ) {
    throw new Error("Judge prompt fingerprint changed");
  }

  const anonymousCriteria = options.sourceJudging
    ? criteria.map((criterion) => ({
        ...criterion,
        source: {
          path:
            options.sourceJudging?.provenance.find(
              (entry) => entry.path === criterion.source.path,
            )?.id ?? `criterion-${criterion.id}`,
          quote: criterion.source.quote,
        },
      }))
    : criteria;

  const response = await options.call({
    cwd: options.cwd,
    access: "none",
    outputSchema: judgmentOutputSchema,
    prompt: [
      ...judgeInstructions,
      ...(options.packet || options.sourceJudging
        ? groundedJudgeInstructions
        : []),
      ...(options.sourceJudging ? sourceJudgeInstructions : []),
      ...(options.sourceJudging?.version === 4
        ? adherenceJudgeInstructions
        : []),
      JSON.stringify({
        prompt: options.scenario.prompt,
        completion: options.scenario.completion,
        criteria:
          options.vote % 2 === 0
            ? [...anonymousCriteria].reverse()
            : anonymousCriteria,
        candidate: JSON.parse(options.candidate.evidence),
        ...(options.packet && options.scenario.mode === "advice"
          ? { repositoryEvidence: options.packet }
          : {}),
        ...(options.sourceJudging && options.scenario.mode === "advice"
          ? { sourceEvidence: options.sourceJudging.packet }
          : {}),
      }),
    ].join("\n\n"),
  });

  const parsed = judgmentSchema.parse(structuredValue(response));
  const identifiers = new Set(parsed.checks.map((check) => check.id));

  if (
    parsed.checks.length !== criteria.length ||
    identifiers.size !== criteria.length ||
    criteria.some((criterion) => !identifiers.has(criterion.id))
  ) {
    throw new Error(
      "Guidance judge returned missing, repeated, or unknown criteria",
    );
  }

  return parsed.checks;
}

export function aggregateChecks(candidate: GuidanceResult): GuidanceCheck[] {
  const identifiers = new Set(
    candidate.votes.flatMap((vote) => vote.checks.map((check) => check.id)),
  );

  return [
    ...candidate.deterministic,
    ...[...identifiers].map((id): GuidanceCheck => {
      const checks = candidate.votes.flatMap((vote) =>
        vote.checks.filter((check) => check.id === id),
      );
      const passed = checks.filter((check) => check.verdict === "pass").length;
      const failed = checks.filter((check) => check.verdict === "fail").length;

      return {
        id,
        verdict: passed >= 2 ? "pass" : failed >= 2 ? "fail" : "unknown",
        evidence: checks
          .map((check) => check.evidence)
          .join("\n")
          .slice(0, 1200),
      };
    }),
  ];
}
