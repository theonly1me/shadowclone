import { z } from "zod";
import {
  pendingReviewSchema,
  readReviewComments,
  type GuidedGitHub,
  type PendingReview,
  type ReviewComment,
} from "./github";
import type { PreparedComment, PreparedReview } from "./schema";

const graphCommentSchema = z.object({
  id: z.string(),
  path: z.string(),
  body: z.string(),
  line: z.number().nullable(),
  originalLine: z.number().nullable(),
  diffSide: z.enum(["LEFT", "RIGHT"]),
  startLine: z.number().nullable(),
  originalStartLine: z.number().nullable(),
  startDiffSide: z.enum(["LEFT", "RIGHT"]).nullable(),
});

async function anchoredComments(options: {
  readonly github: GuidedGitHub;
  readonly comments: readonly ReviewComment[];
}): Promise<readonly ReviewComment[]> {
  const missing = options.comments.filter(
    (comment) => comment.side == null || (comment.line == null && comment.original_line == null),
  );
  if (!missing.length) return options.comments;
  const ids = missing.map((comment) => comment.node_id);
  if (ids.some((id) => !id))
    throw new Error(
      "GitHub omitted draft anchors. Inspect the saved pending review before retrying.",
    );
  const response = z
    .object({ data: z.object({ nodes: z.array(graphCommentSchema.nullable()) }) })
    .parse(
      await options.github.request({
        endpoint: "graphql",
        method: "POST",
        input: {
          query:
            "query DraftAnchors($ids: [ID!]!) { nodes(ids: $ids) { ... on PullRequestReviewComment { id path body line originalLine diffSide startLine originalStartLine startDiffSide } } }",
          variables: { ids },
        },
      }),
    );
  return options.comments.map((comment) => {
    const node = response.data.nodes.find((item) => item?.id === comment.node_id);
    if (!node) return comment;
    return {
      ...comment,
      line: node.line ?? node.originalLine,
      side: node.diffSide,
      start_line: node.startLine ?? node.originalStartLine,
      start_side: node.startDiffSide,
    };
  });
}

function matchesComment(options: {
  readonly actual: ReviewComment;
  readonly intended: PreparedComment;
}): boolean {
  const { actual, intended } = options;
  return (
    actual.path === intended.path &&
    actual.body === intended.body &&
    (actual.line ?? actual.original_line) === intended.line &&
    actual.side === intended.side &&
    actual.in_reply_to_id == null &&
    (intended.startLine === intended.line ||
      ((actual.start_line ?? actual.original_start_line) === intended.startLine &&
        actual.start_side === intended.side))
  );
}

export async function verifyPendingReview(options: {
  readonly github: GuidedGitHub;
  readonly prefix: string;
  readonly reviewId: number;
  readonly login: string;
  readonly headSha: string;
  readonly prepared: PreparedReview;
  readonly pullUrl: string;
}): Promise<PendingReview> {
  const review = pendingReviewSchema.parse(
    await options.github.request({ endpoint: options.prefix + "/reviews/" + options.reviewId }),
  );
  if (
    review.state !== "PENDING" ||
    review.submitted_at != null ||
    review.user.login !== options.login ||
    review.commit_id !== options.headSha ||
    (review.body ?? "") !== ""
  )
    throw new Error(
      "The returned review is not the intended private pending draft. Inspect its saved link.",
    );
  const url = new URL(review.html_url);
  if (
    url.origin !== "https://github.com" ||
    !(
      review.html_url === options.pullUrl ||
      review.html_url.startsWith(options.pullUrl + "#") ||
      review.html_url.startsWith(options.pullUrl + "/")
    )
  )
    throw new Error("GitHub returned a review link outside the selected PR.");
  const comments = await anchoredComments({
    github: options.github,
    comments: await readReviewComments(options),
  });
  if (comments.length !== options.prepared.comments.length)
    throw new Error(
      "The pending comment count differs from the selected feedback. Inspect the saved draft.",
    );
  const unmatched = [...comments];
  for (const intended of options.prepared.comments) {
    const index = unmatched.findIndex((actual) => matchesComment({ actual, intended }));
    if (index < 0)
      throw new Error(
        "A pending comment or anchor differs from the intended feedback. Inspect the saved draft.",
      );
    unmatched.splice(index, 1);
  }
  return review;
}

export async function findRecoverableReview(options: {
  readonly github: GuidedGitHub;
  readonly prefix: string;
  readonly reviews: readonly PendingReview[];
  readonly login: string;
  readonly headSha: string;
  readonly prepared: PreparedReview;
}): Promise<PendingReview | null> {
  for (const review of options.reviews.filter(
    (item) =>
      item.state === "PENDING" &&
      item.user.login === options.login &&
      item.commit_id === options.headSha,
  )) {
    const comments = await readReviewComments({ ...options, reviewId: review.id });
    const expected = options.prepared.comments;
    if (
      comments.length === expected.length &&
      expected.every((intended) =>
        comments.some((actual) => actual.path === intended.path && actual.body === intended.body),
      )
    )
      return review;
  }
  return null;
}
