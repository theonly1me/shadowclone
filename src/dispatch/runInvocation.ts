import { z } from "zod";
import type { EngineRun, EngineRunner } from "../engine";
import type { ProjectPaths } from "../paths";
import { remoteDraftSchema } from "./remoteActions";
import type { ResolvedDispatchPolicy } from "./types";
import type { Worktree } from "./worktree";

type RunInvocation = {
  readonly prompt: string;
  readonly sessionId: string;
  readonly schema: boolean;
};

export function createRunInvocation(options: {
  readonly runner: EngineRunner;
  readonly worktree: Worktree;
  readonly paths: ProjectPaths;
  readonly compiledProfilePath: string;
  readonly dispatchPolicy: ResolvedDispatchPolicy;
}): (run: RunInvocation) => Promise<EngineRun> {
  const { runner, worktree, paths, compiledProfilePath, dispatchPolicy } =
    options;

  return ({ prompt, sessionId, schema }) =>
    runner({
      prompt,
      cwd: worktree.worktreeDirectory,
      execution: {
        purpose: "dispatch",
        allowedDomains: [],
        blockedPaths: [worktree.repoDirectory, paths.shadowcloneDirectory],
        repositoryDirectory: worktree.repoDirectory,
      },
      systemPromptFile: compiledProfilePath,
      sessionId,
      allowedTools: dispatchPolicy.allowedTools,
      disallowedTools: dispatchPolicy.disallowedTools,
      permissionMode: dispatchPolicy.permissionMode,
      maxBudgetUsd: dispatchPolicy.maxBudgetUsd,
      ...(schema ? { outputSchema: z.toJSONSchema(remoteDraftSchema) } : {}),
    });
}
