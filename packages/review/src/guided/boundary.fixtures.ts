import { z } from "zod";
import type { EngineRunner } from "@shadowclone/agents";
import type { preparedReviewSchema, GitHubRequest, GuidedGitHub } from "./index";

export const payloadSchema = z.strictObject({
  commit_id: z.string(),
  comments: z.array(
    z.object({
      path: z.string(),
      line: z.number(),
      side: z.enum(["LEFT", "RIGHT"]),
      body: z.string(),
      start_line: z.number().optional(),
      start_side: z.enum(["LEFT", "RIGHT"]).optional(),
    }),
  ),
});

export function draftBoundaryFixture(options: {
  readonly headSha: string;
  readonly baseSha: string;
  readonly url: string;
  readonly reply: z.infer<typeof preparedReviewSchema>;
}) {
  const { headSha, baseSha, url, reply } = options;
  const state: {
    headSha: string;
    baseSha: string;
    reply: z.infer<typeof preparedReviewSchema>;
    modelCalls: number;
    requests: GitHubRequest[];
    payloads: z.infer<typeof payloadSchema>[];
    reviews: {
      id: number;
      state: string;
      html_url: string;
      commit_id: string;
      user: { login: string };
      body: string;
      submitted_at: null;
    }[];
    loseResponse: boolean;
    wrongAnchor: boolean;
    beforeReply: () => Promise<void>;
  } = {
    headSha,
    baseSha,
    reply,
    modelCalls: 0,
    requests: [],
    payloads: [],
    reviews: [],
    loseResponse: false,
    wrongAnchor: false,
    beforeReply: async () => undefined,
  };
  const github: GuidedGitHub = {
    request: async (request) => {
      state.requests.push(request);
      if (request.endpoint === "user") return { login: "example-reviewer" };
      if (request.endpoint === "repos/example/project/pulls/1")
        return {
          state: "open",
          html_url: url,
          head: { sha: state.headSha },
          base: { sha: state.baseSha },
        };
      if (request.endpoint.endsWith("/reviews") && request.method === "POST") {
        state.payloads.push(payloadSchema.parse(request.input));
        const review = {
          id: 9,
          state: "PENDING",
          html_url: url + "#pullrequestreview-9",
          commit_id: state.headSha,
          user: { login: "example-reviewer" },
          body: "",
          submitted_at: null,
        };
        state.reviews.push(review);
        if (state.loseResponse) {
          state.loseResponse = false;
          throw new Error("The response was lost.");
        }
        return review;
      }
      if (request.endpoint.endsWith("/reviews")) return [state.reviews];
      if (request.endpoint.endsWith("/comments"))
        return [
          state.payloads.flatMap((payload) =>
            payload.comments.map((comment) => ({
              ...comment,
              line: state.wrongAnchor ? 99 : comment.line,
            })),
          ),
        ];
      const found = state.reviews.find((review) =>
        request.endpoint.endsWith("/reviews/" + review.id),
      );
      if (found) return found;
      throw new Error("Unexpected synthetic GitHub request: " + request.endpoint);
    },
  };
  const runner: EngineRunner = async (run) => {
    state.modelCalls += 1;
    if (!run.prompt.includes("Synthetic review voice") || run.execution.purpose !== "review")
      throw new Error("The synthetic runner did not receive scoped review context.");
    await state.beforeReply();
    return {
      engine: "claude-code",
      sessionId: "synthetic-session",
      transcriptPath: null,
      text: "",
      structured: state.reply,
      costUsd: null,
      durationMs: 0,
      turns: 1,
      isError: false,
      permissionDenials: [],
      actions: [],
      errorMessage: null,
    };
  };

  return { state, github, runner };
}
