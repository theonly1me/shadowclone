import { z } from "zod";
import { runCommand } from "../dispatch/command";
import type { TaskContext } from "./context";
import type { TaskRecord } from "./schema";

const pullRequestSchema = z.object({
  number: z.number().int().positive(),
  url: z.url(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  headRefName: z.string(),
  headRefOid: z.string(),
  isCrossRepository: z.boolean(),
  isDraft: z.boolean(),
  mergeable: z.string(),
  mergeStateStatus: z.string(),
  reviewDecision: z.string().nullable(),
  author: z.object({ login: z.string() }),
  comments: z.array(z.object({ body: z.string(), url: z.string() })),
  reviews: z.array(
    z.object({
      state: z.string(),
      body: z.string(),
      commit: z.object({ oid: z.string() }).nullable().optional(),
    }),
  ),
});
const checksSchema = z.array(
  z.object({
    name: z.string(),
    bucket: z.enum(["pass", "fail", "pending", "skipping", "cancel"]),
    link: z.string(),
  }),
);

export function githubRepository(task: TaskRecord): string {
  if (!/^github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(task.repositoryId))
    throw new Error(
      "Task PR operations require a recognized GitHub repository",
    );
  return task.repositoryId;
}

export async function inspectTaskPullRequest(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly number?: number;
  },
) {
  const number = options.number ?? options.task.pullRequest;
  if (!number) throw new Error("This task has no recorded pull request");
  const repository = githubRepository(options.task);
  const runner = options.runner ?? runCommand;
  const result = await runner({
    command: [
      "gh",
      "pr",
      "view",
      String(number),
      "--repo",
      repository,
      "--json",
      "number,url,state,headRefName,headRefOid,isCrossRepository,isDraft,mergeable,mergeStateStatus,reviewDecision,author,comments,reviews",
    ],
    cwd: options.task.worktree,
  });
  if (result.exitCode !== 0)
    throw new Error("Could not inspect this task's pull request");
  const pullRequest = pullRequestSchema.parse(JSON.parse(result.stdout));
  const viewer = await runner({
    command: ["gh", "api", "user", "--jq", ".login"],
    cwd: options.task.worktree,
  });
  if (
    viewer.exitCode !== 0 ||
    viewer.stdout.trim() !== pullRequest.author.login
  )
    throw new Error(
      "Task maintenance is restricted to PRs owned by the authenticated account",
    );
  if (
    pullRequest.number !== number ||
    pullRequest.isCrossRepository ||
    pullRequest.headRefName !== options.task.baseline.branch
  )
    throw new Error("Pull request does not belong to the task branch");
  let checksResult = await runner({
    command: [
      "gh",
      "pr",
      "checks",
      String(number),
      "--repo",
      repository,
      "--required",
      "--json",
      "name,bucket,link",
    ],
    cwd: options.task.worktree,
  });
  let checks: z.infer<typeof checksSchema> | null = null;
  try {
    checks = checksSchema.parse(JSON.parse(checksResult.stdout));
  } catch {
    checks = null;
  }
  if (checks === null) {
    checksResult = await runner({
      command: [
        "gh",
        "pr",
        "checks",
        String(number),
        "--repo",
        repository,
        "--json",
        "name,bucket,link",
      ],
      cwd: options.task.worktree,
    });
    try {
      checks = checksSchema.parse(JSON.parse(checksResult.stdout));
    } catch {
      checks = null;
    }
  }
  const reasons: string[] = [];
  if (pullRequest.state !== "OPEN")
    reasons.push(`Pull request is ${pullRequest.state.toLowerCase()}`);
  if (pullRequest.isDraft) reasons.push("Pull request is still a draft");
  if (pullRequest.mergeable !== "MERGEABLE")
    reasons.push("Conflicts or mergeability still need resolution");
  if (
    pullRequest.mergeStateStatus !== "CLEAN" &&
    pullRequest.mergeStateStatus !== "HAS_HOOKS"
  )
    reasons.push("GitHub has not reported a clean merge state");
  if (
    pullRequest.reviewDecision === "REVIEW_REQUIRED" ||
    pullRequest.reviewDecision === "CHANGES_REQUESTED"
  )
    reasons.push("Required GitHub review approval is missing");
  if (
    pullRequest.reviewDecision &&
    !["APPROVED", "REVIEW_REQUIRED", "CHANGES_REQUESTED"].includes(
      pullRequest.reviewDecision,
    )
  )
    reasons.push("GitHub review state is unknown");
  if (
    checks === null ||
    checksResult.exitCode !== 0 ||
    checks.some((check) => check.bucket !== "pass")
  )
    reasons.push("Required CI checks have not been confirmed successful");
  if (
    pullRequest.reviewDecision === "APPROVED" &&
    !pullRequest.reviews.some(
      (review) =>
        review.state === "APPROVED" &&
        review.commit?.oid === pullRequest.headRefOid,
    )
  )
    reasons.push("The current PR head has no recorded approval");
  return { pullRequest, checks, ready: reasons.length === 0, reasons };
}
