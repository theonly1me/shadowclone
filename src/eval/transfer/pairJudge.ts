import { aggregateVotes, binaryMajority } from "./aggregateVotes";
import { evaluationArmOrder, type EvaluationArm } from "./arms";
import { judgeBatch } from "./judgeBatch";
import { judgeWork, preferenceIdentifier } from "./judgeWork";
import { fingerprint } from "./structured";
import type { JudgeBatchVote, JudgingState } from "./judgeTypes";
import type { ModelCall, PreferenceCheck } from "./types";

type CandidateOptions = {
  readonly taskPrompt: string;
  readonly correctness: readonly string[];
  readonly preferences: readonly PreferenceCheck[];
  readonly evidence: string;
  readonly cwd: string;
  readonly call: ModelCall;
  readonly saved?: JudgingState;
  readonly onCheckpoint?: (state: JudgingState) => Promise<void>;
  readonly onVote: (vote: number) => Promise<void>;
};

function results(options: {
  readonly requirements: readonly string[];
  readonly identifiers: readonly string[];
  readonly completed: readonly JudgeBatchVote[];
  readonly kind: "correctness" | "preferences";
}) {
  return aggregateVotes({
    requirements: options.requirements,
    votes: [1, 2, 3].map((vote) => options.identifiers.map((identifier) => {
      const check = options.completed.filter((batch) => batch.vote === vote && batch.kind === options.kind)
        .flatMap((batch) => batch.checks).find((candidate) => candidate.id === identifier);
      if (!check) throw new Error("Cannot aggregate incomplete judge votes");
      return { verdict: check.verdict, evidence: check.evidence };
    })),
    resolve: binaryMajority,
  });
}

export async function judgeCandidate(options: CandidateOptions) {
  const work = judgeWork(options);
  const completed = [...(options.saved?.completed ?? [])];
  if (new Set(completed.map((batch) => batch.id)).size !== completed.length ||
    completed.some((batch) => !work.some((expected) => expected.id === batch.id &&
      expected.criteria.length === batch.checks.length &&
      expected.criteria.every((identifier, index) => batch.checks[index]?.id === identifier)))) {
    throw new Error("Saved judge votes do not match frozen work");
  }
  let state: JudgingState = {
    completed,
    pending: work.filter((batch) => !completed.some((saved) => saved.id === batch.id)),
    attempts: options.saved?.attempts ?? [],
  };
  await options.onCheckpoint?.(state);
  let lastVote = 0;
  for (const batch of state.pending) {
    if (batch.vote !== lastVote) {
      lastVote = batch.vote;
      await options.onVote(batch.vote);
    }
    const result = await judgeBatch({
      ...options,
      work: batch,
      previousAttempts: Math.max(0, ...state.attempts.filter((attempt) => attempt.workId === batch.id).map((attempt) => attempt.attempt)),
      onAttempt: async (attempt) => {
        state = { ...state, attempts: [...state.attempts.filter((previous) =>
          previous.workId !== attempt.workId || previous.attempt !== attempt.attempt), attempt] };
        await options.onCheckpoint?.(state);
      },
    });
    completed.push(result);
    state = { ...state, completed: [...completed], pending: state.pending.filter((pending) => pending.id !== batch.id) };
    await options.onCheckpoint?.(state);
  }
  return {
    correctness: results({ kind: "correctness", requirements: options.correctness, identifiers: options.correctness.map((requirement) => fingerprint(requirement).slice(0, 16)), completed }),
    preferences: results({ kind: "preferences", requirements: options.preferences.map((check) => check.requirement), identifiers: options.preferences.map(preferenceIdentifier), completed }),
  };
}

export async function judgeArms(options: Omit<CandidateOptions, "evidence" | "saved" | "onCheckpoint"> & {
  readonly evidence: Readonly<Record<EvaluationArm, string>>;
}) {
  const judgments = await Promise.all(evaluationArmOrder.map(async (arm) => ({
    arm,
    judgment: await judgeCandidate({ ...options, evidence: options.evidence[arm] }),
  })));
  const judgment = (arm: EvaluationArm) => {
    const result = judgments.find((candidate) => candidate.arm === arm);
    if (!result) throw new Error("Missing candidate judgment");
    return result.judgment;
  };
  return { bare: judgment("bare"), skills: judgment("skills"), clone: judgment("clone") };
}
