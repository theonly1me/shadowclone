import { z } from "zod";

export const commentSources = [
  "issue_comment",
  "pull_request_review_comment",
  "pull_request_review",
] as const;

export type CommentSource = (typeof commentSources)[number];

const identifier = z.number().int().positive();

export const sessionEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("comment"),
    source: z.enum(commentSources),
    id: identifier,
    entity: identifier,
  }),
  z.strictObject({ kind: z.literal("ci"), runId: identifier }),
]);

export type SessionEvent = z.infer<typeof sessionEventSchema>;

export type SessionCommand =
  { readonly kind: "work"; readonly task: string } | { readonly kind: "review" };

const commandPattern = /^\s*\/shadowclone(?=$|\s)/i;

export function parseSessionCommand(body: string): SessionCommand | null {
  const [firstLine = "", ...rest] = body.split(/\r?\n/);

  if (!commandPattern.test(firstLine)) {
    return null;
  }

  const firstLineTask = firstLine.replace(commandPattern, "").trim();

  if (/^review$/i.test(firstLineTask)) {
    return { kind: "review" };
  }

  return { kind: "work", task: [firstLineTask, ...rest].join("\n").trim() };
}

export type SessionRequest = {
  readonly kind: "work" | "review" | "continue";
  readonly source: CommentSource | "workflow_run";
  readonly identifier: number;
  readonly entity: number;
  readonly pull: boolean;
  readonly branch: string;
  readonly head: string;
  readonly ownerAuthored: boolean;
  readonly fork: boolean;
  readonly key: string;
  readonly task: string;
};

export type Resolution =
  | { readonly kind: "accepted"; readonly request: SessionRequest }
  | { readonly kind: "ignored"; readonly reason: string };

export function ignored(reason: string): Resolution {
  return { kind: "ignored", reason };
}

export const pausedLabel = "shadowclone:paused";

export const sessionLabel = "shadowclone";

export function issueBranch(entity: number): string {
  return `shadowclone/issue-${entity}`;
}
