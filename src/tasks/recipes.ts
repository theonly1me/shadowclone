import path from "node:path";
import { sandboxedGate } from "../dispatch/gate";
import type { VerificationRecipe } from "../harness/recipes";
import { assertRegularDestination, fingerprint } from "../localFiles";
import { redactSecrets } from "../redact";
import type { TaskContext } from "./context";
import type { TaskRecord, VerificationCheck } from "./schema";

export async function executeTaskRecipe(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly recipe: VerificationRecipe;
    readonly signal?: AbortSignal;
  },
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];
  const execute = options.execute ?? sandboxedGate;
  const invoke = async (step: {
    readonly command: string;
    readonly phase: string;
  }): Promise<boolean> => {
    try {
      if (options.signal?.aborted && step.phase !== "cleanup")
        throw new Error("Task verification stopped");
      const result = await execute({
        directory: options.task.worktree,
        command: step.command,
        blockedPaths: [options.paths.shadowcloneDirectory],
        protectedPaths: [
          options.task.commonDirectory,
          path.join(options.task.worktree, ".git"),
        ],
        signal: step.phase === "cleanup" ? undefined : options.signal,
      });
      checks.push({
        name: `${options.recipe.name}/${step.phase}`,
        status:
          result.exitCode === 0
            ? "passed"
            : step.phase === "prerequisite"
              ? "incomplete"
              : "failed",
        evidence:
          redactSecrets({ text: result.output.slice(-8000) }) ||
          `Exit ${result.exitCode}`,
      });
      return result.exitCode === 0;
    } catch {
      checks.push({
        name: `${options.recipe.name}/${step.phase}`,
        status: "incomplete",
        evidence:
          "Command could not complete in the credential-free, offline verification sandbox",
      });
      return false;
    }
  };
  for (const command of options.recipe.prerequisites) {
    if (!(await invoke({ command, phase: "prerequisite" }))) return checks;
  }
  try {
    let proceed = true;
    for (const [phase, commands] of [
      ["setup", options.recipe.setup],
      ["run", options.recipe.run],
    ] as const) {
      for (const command of commands) {
        if (!proceed) break;
        proceed = await invoke({ command, phase });
      }
    }
    if (proceed) {
      for (const evidence of options.recipe.evidence) {
        const filePath = path.resolve(options.task.worktree, evidence);
        try {
          if (!filePath.startsWith(`${options.task.worktree}${path.sep}`))
            throw new Error("Evidence must belong to the worktree");
          assertRegularDestination(filePath);
          const file = Bun.file(filePath);
          if (
            !(await file.exists()) ||
            file.size === 0 ||
            file.size > 2_000_000
          )
            throw new Error("Evidence is unavailable");
          checks.push({
            name: `${options.recipe.name}/evidence`,
            status: "passed",
            evidence: `${evidence}: ${fingerprint(Buffer.from(await file.arrayBuffer()).toString("base64"))}`,
          });
        } catch {
          checks.push({
            name: `${options.recipe.name}/evidence`,
            status: "incomplete",
            evidence:
              "Required evidence is missing, outside the worktree, or exceeds the file budget",
          });
        }
      }
    }
  } finally {
    for (const command of options.recipe.cleanup)
      await invoke({ command, phase: "cleanup" });
  }
  return checks;
}
