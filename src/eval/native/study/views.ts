import type { CoverageEntry } from "./coverage";
import { deterministicChecks } from "./checks";
import type { MatrixReceipt } from "./matrix";
import { studyReport } from "./report";
import type { PersonalArm, StudySuite } from "./schema";
import { achievableSuite } from "./validate";

export function achievableReport(options: {
  candidates: StudySuite;
  frozen: StudySuite;
  receipt: MatrixReceipt;
  coverage: Partial<Record<PersonalArm, readonly CoverageEntry[]>>;
}) {
  const suite = achievableSuite({ candidates: options.candidates, dropped: options.frozen.droppedChecks });
  const runs = options.receipt.runs.map((run) => {
    const task = suite.tasks.find((entry) => entry.id === run.taskId);
    return task ? { ...run, checks: deterministicChecks({ record: run, task }) } : run;
  });
  return studyReport({ suite, receipt: { ...options.receipt, runs }, coverage: options.coverage });
}
