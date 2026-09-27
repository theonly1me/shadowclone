import { throwIfEvaluationExpired } from "../transfer/deadline";
import type { ModelCall } from "../transfer/types";
import { executeGuidance } from "./execute";
import { judgeGuidance } from "./judge";
import { arms, type GuidanceReceipt, type GuidanceSuite } from "./schema";

export async function executeGuidanceCases(options: {
  readonly progress: { receipt: GuidanceReceipt };
  readonly suite: GuidanceSuite;
  readonly pilot: boolean;
  readonly engine: "claude-code" | "codex";
  readonly call: ModelCall;
  readonly controlDirectory: string;
  readonly save: () => Promise<void>;
}): Promise<void> {
  const { progress, suite, pilot, engine, call, controlDirectory, save } =
    options;

  for (const scenario of suite.scenarios.filter(
    (candidate) => !pilot || candidate.pilot,
  )) {
    for (let repeat = 0; repeat < progress.receipt.repeat; repeat += 1) {
      const rotation =
        (suite.scenarios.indexOf(scenario) + repeat) % arms.length;

      for (const arm of [...arms.slice(rotation), ...arms.slice(0, rotation)]) {
        throwIfEvaluationExpired();

        let candidate = progress.receipt.runs.find(
          (run) =>
            run.scenarioId === scenario.id &&
            run.repeat === repeat &&
            run.arm === arm,
        );

        if (candidate?.complete) {
          continue;
        }

        console.log(
          `guidance ${scenario.id} repeat ${repeat + 1} ${arm}: ${candidate ? "judging saved evidence" : "executing"}`,
        );

        if (!candidate) {
          candidate = await executeGuidance({
            suite,
            scenario,
            arm,
            repeat,
            call,
            engine,
          });
          throwIfEvaluationExpired();
          progress.receipt = {
            ...progress.receipt,
            runs: [...progress.receipt.runs, candidate],
          };
          await save();
        }

        const replace = (): void => {
          const updated = candidate;

          if (!updated) {
            throw new Error("Candidate is unavailable");
          }

          progress.receipt = {
            ...progress.receipt,
            runs: progress.receipt.runs.map((run) =>
              run.scenarioId === scenario.id &&
              run.repeat === repeat &&
              run.arm === arm
                ? updated
                : run,
            ),
          };
        };

        if (candidate.safety === "fail") {
          throw new Error("Candidate failed snapshot safety checks");
        }

        for (const vote of [1, 2]) {
          if (candidate.votes.some((entry) => entry.vote === vote)) {
            continue;
          }

          const checks = await judgeGuidance({
            scenario,
            candidate,
            vote,
            cwd: controlDirectory,
            call,
            packet:
              progress.receipt.judging?.version === 2
                ? progress.receipt.judging.packet
                : undefined,
            sourceJudging:
              progress.receipt.judging?.version === 3 ||
              progress.receipt.judging?.version === 4
                ? progress.receipt.judging
                : undefined,
          });

          throwIfEvaluationExpired();
          candidate = {
            ...candidate,
            votes: [...candidate.votes, { vote, checks }],
          };
          replace();
          await save();
        }

        candidate = { ...candidate, complete: true };
        replace();
        await save();
      }
    }
  }
}
