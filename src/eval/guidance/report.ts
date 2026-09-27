import { aggregateChecks } from "./judge";
import { arms, dimensionSchema, type GuidanceReceipt } from "./schema";

export function guidanceReport(receipt: GuidanceReceipt) {
  const scenarios = receipt.suite.scenarios.filter((scenario) => !receipt.pilot || scenario.pilot);
  const completed = receipt.runs.filter((run) => run.complete);
  return {
    protocol: receipt.protocol,
    evalId: receipt.evalId,
    suiteId: receipt.suite.suiteId,
    status: receipt.status,
    model: receipt.model,
    resolvedModels: [...new Set(receipt.runs.map((run) => run.resolvedModel))],
    effort: receipt.effort,
    pilot: receipt.pilot,
    measurementVersion: receipt.validation || receipt.maintenance || receipt.comparison ? 2 : null,
    validation: receipt.validation ?? null,
    maintenance: receipt.maintenance ?? null,
    comparison: receipt.comparison ?? null,
    judging: receipt.judging ? { version: receipt.judging.version, promptFingerprint: receipt.judging.promptFingerprint, packetFingerprint: receipt.judging.packetFingerprint } : null,
    expectedResponses: scenarios.length * arms.length * receipt.repeat,
    completedResponses: completed.length,
    conditions: arms.map((arm) => {
      const runs = completed.filter((run) => run.arm === arm);
      const observed = receipt.runs.filter((run) => run.arm === arm);
      return {
        arm,
        label: { bare: "Bare", skills: "Skills", memory: "Skills + Claude memory", clone: "Skills + Shadowclone" }[arm],
        completedResponses: runs.length,
        scores: dimensionSchema.options.map((dimension) => {
          const checks = scenarios.flatMap((scenario) => runs.filter((run) => run.scenarioId === scenario.id).flatMap((run) =>
            scenario.criteria.filter((criterion) => criterion.dimension === dimension).map((criterion) =>
              aggregateChecks(run).find((check) => check.id === criterion.id)?.verdict ?? "unknown"
            )
          ));
          const passed = checks.filter((verdict) => verdict === "pass").length;
          const unknown = checks.filter((verdict) => verdict === "unknown").length;
          return { dimension, passed, failed: checks.length - passed - unknown, unknown, total: checks.length,
            lowerPercent: checks.length === 0 ? null : 100 * passed / checks.length,
            upperPercent: checks.length === 0 ? null : 100 * (passed + unknown) / checks.length };
        }),
        repetitions: observed.map((run) => ({
          scenarioId: run.scenarioId, repeat: run.repeat + 1, complete: run.complete,
          checks: aggregateChecks(run).map(({ id, verdict }) => ({ id, verdict })),
          delivery: run.measurementVersion === 2 ? "normalized-events" : "legacy-unreliable",
          successfulReads: run.measurementVersion === 2 ? run.reads.length : null,
          requiredSkills: run.requiredSkills.map((skill) => ({ ...skill, loaded: run.measurementVersion === 2 ? skill.loaded : null, beforeEdit: run.measurementVersion === 2 ? skill.beforeEdit : null })),
          referenceReads: run.expectedReferences.map((reference) => ({ ...reference, loaded: run.measurementVersion === 2 ? reference.loaded : null })),
        })),
        requiredSkills: observed.flatMap((run) => run.requiredSkills.map((skill) => ({ ...skill, loaded: run.measurementVersion === 2 ? skill.loaded : null, beforeEdit: run.measurementVersion === 2 ? skill.beforeEdit : null }))),
        referenceReads: observed.flatMap((run) => run.expectedReferences.map((reference) => ({ ...reference, loaded: run.measurementVersion === 2 ? reference.loaded : null }))),
        safetyFailures: observed.filter((run) => run.safety === "fail").length,
        syntaxErrors: observed.filter((run) => run.verification === "syntax-error").length,
        focusedTests: receipt.protocol !== "guidance-v1" ? {
          passed: observed.filter((run) => run.verification === "pass").length,
          failed: observed.filter((run) => run.verification === "fail").length,
          unknown: observed.filter((run) => run.verification === "not-verified").length,
        } : null,
        correctness: receipt.protocol !== "guidance-v1" ? "Changed test files run in a network-disabled snapshot when available; this is a focused check, not full correctness proof." : "Tests and typechecks were not executed. This is not a correctness success rate.",
      };
    }),
    failure: receipt.failure,
    limitations: ["A pilot checks delivery and grading, not superiority.", "Small paired sample; no statistical significance claim.", "Unknown judgments remain in the denominator and form score intervals.", "Only successful Read results establish skill/reference delivery; shell reads are not credited.",
      "A missing Read observation is not proof that guidance was unused. Legacy counts and timing are unreliable.", "Null beforeEdit means timing is unknown, including unclassified shell activity. Earlier means read completion before a successful mutation request."],
  };
}
