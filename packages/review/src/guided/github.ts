import { z } from "zod";
import { hostEnvironment, runProcess } from "@shadowclone/core";

export type GitHubRequest = {
  readonly endpoint: string;
  readonly method?: "GET" | "POST";
  readonly input?: unknown;
  readonly paginate?: boolean;
};
export type GuidedGitHub = { readonly request: (request: GitHubRequest) => Promise<unknown> };

export function guidedGitHub(cwd: string): GuidedGitHub {
  return {
    request: async (request) => {
      const result = await runProcess({
        arguments: [
          "gh",
          "api",
          request.endpoint,
          ...(request.paginate ? ["--paginate", "--slurp"] : []),
          ...(request.method === "POST" ? ["--method", "POST", "--input", "-"] : []),
        ],
        input: request.method === "POST" ? JSON.stringify(request.input) : undefined,
        cwd,
        environment: hostEnvironment({ remote: true }),
        timeoutMilliseconds: 60_000,
      });
      if (result.exitCode !== 0)
        throw new Error(
          "GitHub could not complete the draft action. Check gh authentication and the PR state.",
        );
      return JSON.parse(result.stdout);
    },
  };
}

export const currentPullSchema = z.object({
  state: z.enum(["open", "closed"]),
  html_url: z.url(),
  head: z.object({ sha: z.string().regex(/^[a-f0-9]{40,64}$/) }),
  base: z.object({ sha: z.string().regex(/^[a-f0-9]{40,64}$/) }),
});
export type CurrentPull = z.infer<typeof currentPullSchema>;

export const pendingReviewSchema = z.object({
  id: z.number().int().positive(),
  state: z.string(),
  html_url: z.url(),
  commit_id: z.string(),
  user: z.object({ login: z.string() }),
  body: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
});
export type PendingReview = z.infer<typeof pendingReviewSchema>;

export const reviewCommentSchema = z.object({
  node_id: z.string().optional(),
  path: z.string(),
  body: z.string(),
  line: z.number().nullable().optional(),
  original_line: z.number().nullable().optional(),
  side: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  start_line: z.number().nullable().optional(),
  original_start_line: z.number().nullable().optional(),
  start_side: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  in_reply_to_id: z.number().nullable().optional(),
});
export type ReviewComment = z.infer<typeof reviewCommentSchema>;

export async function readCurrentPull(options: {
  readonly github: GuidedGitHub;
  readonly repository: string;
  readonly number: number;
}): Promise<CurrentPull> {
  return currentPullSchema.parse(
    await options.github.request({
      endpoint: "repos/" + options.repository + "/pulls/" + options.number,
    }),
  );
}

export async function readReviewer(github: GuidedGitHub): Promise<string> {
  return z.object({ login: z.string().min(1) }).parse(await github.request({ endpoint: "user" }))
    .login;
}

export async function readPendingReviews(options: {
  readonly github: GuidedGitHub;
  readonly prefix: string;
}): Promise<readonly PendingReview[]> {
  return z
    .array(z.array(pendingReviewSchema))
    .parse(await options.github.request({ endpoint: options.prefix + "/reviews", paginate: true }))
    .flat();
}

export async function readReviewComments(options: {
  readonly github: GuidedGitHub;
  readonly prefix: string;
  readonly reviewId: number;
}): Promise<readonly ReviewComment[]> {
  return z
    .array(z.array(reviewCommentSchema))
    .parse(
      await options.github.request({
        endpoint: options.prefix + "/reviews/" + options.reviewId + "/comments",
        paginate: true,
      }),
    )
    .flat();
}
