import path from "node:path";
import { z } from "zod";
import { redactSecrets } from "../redact";
import type { ActionCapability } from "../config";
import { ownedWrite } from "../storage";
import { runCommand, type CommandRunner } from "./command";
import type { Worktree } from "./worktree";

export const remoteDraftSchema = z.strictObject({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(65_000),
});

export async function executeRemoteActions(options: {
  readonly granted: readonly ActionCapability[];
  readonly repositoryId: string;
  readonly worktree: Worktree;
  readonly runDirectory: string;
  readonly structured: unknown;
  readonly pullRequestNumber?: number;
  readonly runner?: CommandRunner;
}): Promise<readonly string[]> {
  const actions = options.granted.filter(
    (action) => action === "pr-draft" || action === "pr-reply",
  );
  if (actions.length === 0) {
    return [];
  }
  if (
    !/^github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(options.repositoryId)
  ) {
    throw new Error("Remote PR actions require a recognized GitHub repository");
  }
  const parsedDraft = remoteDraftSchema.parse(options.structured);
  const draft = {
    title: redactSecrets({ text: parsedDraft.title }),
    body: redactSecrets({ text: parsedDraft.body }),
  };
  const bodyPath = path.join(options.runDirectory, "remote-body.md");
  await ownedWrite({ path: bodyPath, content: draft.body });
  const runner = options.runner ?? runCommand;
  const completed: string[] = [];
  for (const action of actions) {
    if (
      action === "pr-reply" &&
      (!Number.isSafeInteger(options.pullRequestNumber) ||
        (options.pullRequestNumber ?? 0) <= 0)
    ) {
      throw new Error("PR replies require an explicit --pr number");
    }
    const command =
      action === "pr-draft"
        ? [
            "gh",
            "pr",
            "create",
            "--draft",
            "--repo",
            options.repositoryId,
            "--head",
            options.worktree.branch,
            "--title",
            draft.title,
            "--body-file",
            bodyPath,
          ]
        : [
            "gh",
            "pr",
            "comment",
            String(options.pullRequestNumber),
            "--repo",
            options.repositoryId,
            "--body-file",
            bodyPath,
          ];
    const result = await runner({
      command,
      cwd: options.worktree.repoDirectory,
    });
    if (result.exitCode !== 0) {
      throw new Error("Approved repository PR action failed");
    }
    completed.push(action);
  }
  return completed;
}
