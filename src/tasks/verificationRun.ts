import { runHarnessCheck } from "../harness/check";
import type { TaskContext } from "./context";
import { executeTaskRecipe } from "./recipes";
import type {
  TaskRecord,
  VerificationCheck,
  WorkspaceSnapshot,
} from "./schema";
import { outsideTaskScope, snapshotWorkspace } from "./snapshot";

export async function runTaskVerification(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly before: WorkspaceSnapshot;
    readonly attempts: number;
    readonly signal: AbortSignal;
  },
): Promise<NonNullable<TaskRecord["verification"]>> {
  const { task } = options;
  const checks: VerificationCheck[] = [];
  if (
    outsideTaskScope({
      baseline: task.baseline,
      current: options.before,
      scopes: task.input.scopes,
    }).length > 0
  )
    checks.push({
      name: "scope",
      status: "failed",
      evidence: "Changes extend outside the assignment",
    });
  if (task.harnessFingerprint !== null) {
    const harness = await runHarnessCheck({
      root: task.worktree,
      changed: false,
      runner: options.runner,
    });
    checks.push({
      name: "repository conventions",
      status: harness.findings.some((finding) => finding.severity === "error")
        ? "failed"
        : harness.findings.some((finding) => finding.severity === "warning")
          ? "incomplete"
          : "passed",
      evidence: JSON.stringify({
        checkedFiles: harness.checkedFiles,
        findings: harness.findings,
      }).slice(0, 8000),
    });
  }
  const recipes = [
    ...(task.gate
      ? [
          {
            name: "repository gate",
            kind: "test" as const,
            prerequisites: [],
            setup: [],
            run: [task.gate],
            evidence: [],
            cleanup: [],
          },
        ]
      : []),
    ...task.recipes,
  ];
  if (recipes.length === 0)
    checks.push({
      name: "verification",
      status: "incomplete",
      evidence: "No gate or task verification recipe is configured",
    });
  for (const recipe of recipes) {
    if (options.signal.aborted) break;
    checks.push(...(await executeTaskRecipe({ ...options, recipe })));
  }
  if (options.signal.aborted)
    checks.push({
      name: "interruption",
      status: "incomplete",
      evidence: "Task verification stopped after a pause or cancellation",
    });
  const after = await snapshotWorkspace(options);
  if (options.before.fingerprint !== after.fingerprint)
    checks.push({
      name: "workspace stability",
      status: "incomplete",
      evidence:
        "Verification changed the tracked or untracked workspace; review changes before retrying",
    });
  const status = checks.some((check) => check.status === "failed")
    ? "failed"
    : checks.some((check) => check.status === "incomplete")
      ? "incomplete"
      : "passed";
  return {
    snapshot: after,
    guidance: task.guidance.fingerprint,
    attempts: options.attempts,
    checks,
    status,
    at: new Date().toISOString(),
  };
}
