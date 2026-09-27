import { expect, test } from "bun:test";
import path from "node:path";
import type { EngineRunner } from "../../../engine";
import { candidateFixture } from "../fixtures";
import { runGuidanceEvaluation } from "../run";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  saveGuidanceReceipt,
} from "../store";
import { comparisonFixture } from "./fixtures";

test("comparison resumes saved evidence and votes across all four cases for exactly 96 invocations", async () => {
  const fixture = await comparisonFixture();

  try {
    const initialized = await fixture.initialize();
    const directory = guidanceDirectory({
      paths: fixture.paths,
      evalId: initialized.evalId,
    });

    const candidate = {
      ...candidateFixture(),
      arm: "bare" as const,
      votes: [
        {
          vote: 1,
          checks: [
            {
              id: "complete-names",
              verdict: "pass" as const,
              evidence: "Saved vote",
            },
          ],
        },
      ],
    };

    await saveGuidanceReceipt({
      paths: fixture.paths,
      receipt: { ...initialized, runs: [candidate] },
    });

    const budgetPath = path.join(directory, "budget.json");

    await Bun.write(
      budgetPath,
      JSON.stringify({
        version: 1,
        limitUsd: 20,
        spentUsd: 0.02,
        calls: 2,
        maximumCalls: 96,
        pending: false,
        unknownCost: false,
      }),
    );

    let calls = 2;
    let generations = 1;

    const runner: EngineRunner = async (request) => {
      calls += 1;

      expect(request.maxBudgetUsd).toBeCloseTo(20 - (calls - 1) / 100);

      if (calls === 3) {
        expect(request.outputSchema).toBeDefined();
      }

      if (!request.outputSchema) {
        generations += 1;

        if (
          request.execution.purpose === "evaluation" &&
          request.execution.access === "write"
        ) {
          await Bun.write(
            path.join(request.cwd, "result.ts"),
            "export const completeName = true;\n",
          );
        }

        expect(request.prompt).not.toContain("sourceEvidence");
        expect(request.prompt).not.toContain(
          "Separate source adherence from technical validity",
        );
      } else {
        expect(request.prompt).toContain(
          "Separate source adherence from technical validity",
        );
      }

      const id = request.prompt.includes('"id":"focused-test-command"')
        ? "focused-test-command"
        : "complete-names";

      return {
        engine: "claude-code",
        resolvedModel: "claude-sonnet-5",
        sessionId: "fixture",
        transcriptPath: null,
        text: "Use complete names.",
        structured: {
          checks: [
            { id, verdict: "pass", evidence: "Synthetic supported answer." },
          ],
        },
        costUsd: 0.01,
        durationMs: 0,
        turns: 1,
        isError: false,
        permissionDenials: [],
        actions: [],
        errorMessage: null,
      };
    };

    const result = await runGuidanceEvaluation({ ...fixture.request, runner });

    expect(result.failure).toBeNull();
    expect(result.status).toBe("complete");
    expect(result.runs).toHaveLength(32);
    expect(result.runs.flatMap((run) => run.votes)).toHaveLength(64);
    expect(new Set(result.runs.map((run) => run.scenarioId)).size).toBe(4);
    expect(result.runs[0]?.evidence).toBe(candidate.evidence);
    expect(result.runs[0]?.votes[0]).toEqual(candidate.votes[0]);
    expect(result.deadlineAt).toBe(initialized.deadlineAt);
    expect(generations).toBe(32);
    expect(calls).toBe(96);

    const budget = await Bun.file(budgetPath).json();

    expect(budget.calls + (result.comparison?.priorCalls ?? 0)).toBe(217);
    expect(budget.spentUsd).toBeCloseTo(0.96);

    await runGuidanceEvaluation({ ...fixture.request, runner });

    expect(calls).toBe(96);
    expect(
      await Bun.file(path.join(fixture.parentDirectory, "budget.json")).json(),
    ).toEqual(fixture.parentBudget);
    expect(
      await readGuidanceReceipt({
        paths: fixture.paths,
        evalId: fixture.parent.evalId,
      }),
    ).toEqual(fixture.parent);
  } finally {
    await fixture.cleanup();
  }
}, 30000);
