import type { LearningExecution } from "@shadowclone/agents";
import type { ProjectPaths } from "@shadowclone/core";
import type { EnvironmentState } from "@shadowclone/environment";
import { redactSecrets } from "@shadowclone/redact";
import type { CoveredGuidance } from "../../distill";
import { structuredValue } from "../../distill/reconcile/run";
import { applicablePublished, candidateCoverage, publishedRecords } from "./candidates";
import { buildTriagePrompt, type TriageCandidate } from "./prompt";
import { parseTriageOutput, triageOutputSchema } from "./schema";

export async function requestDecisions(options: {
  readonly paths: ProjectPaths;
  readonly execution: LearningExecution;
  readonly candidates: readonly TriageCandidate[];
  readonly redacted: EnvironmentState;
  readonly coverage: readonly CoveredGuidance[];
}) {
  const redactedRecords = new Map(
    options.redacted.records.map((record) => [record.rule.key, record]),
  );
  const candidates = options.candidates.map((candidate) => {
    const record = redactedRecords.get(candidate.record.rule.key);
    if (!record) throw new Error("A pending rule is unavailable in the redacted snapshot");
    return { ...candidate, record };
  });
  const decisions = new Map<string, ReturnType<typeof parseTriageOutput>[number]>();
  const groups = Map.groupBy(
    candidates,
    ({ record: { rule } }) => `${rule.scope}:${rule.originDirectory}:${rule.repositoryName}`,
  );
  for (const group of groups.values()) {
    const [candidate] = group;
    if (!candidate || options.execution.callsRemaining() < 1) break;
    const run = await options.execution.runner({
      prompt: buildTriagePrompt({
        candidates: group,
        published: applicablePublished({
          records: publishedRecords(options.redacted),
          record: candidate.record,
        }),
        coverage: candidateCoverage({ candidate, coverage: options.coverage }),
      }),
      cwd: options.paths.shadowcloneDirectory,
      execution: { purpose: "learning" },
      allowedTools: [],
      permissionMode: "dontAsk",
      outputSchema: triageOutputSchema,
    });
    if (run.isError)
      throw new Error(
        `The agent engine failed during triage: ${redactSecrets({ text: run.errorMessage ?? "no engine detail" })}`,
      );
    for (const decision of parseTriageOutput(structuredValue({ run, purpose: "triage" }))) {
      if (group.some((entry) => entry.token === decision.token))
        decisions.set(decision.token, decision);
    }
  }
  return decisions;
}
