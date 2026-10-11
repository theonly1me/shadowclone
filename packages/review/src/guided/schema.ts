import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{40,64}$/);
const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
export const sourcePathSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\0") &&
      !value.split("/").some((part) => part === "." || part === ".."),
  );
export const sourceRangeSchema = z
  .object({
    path: sourcePathSchema,
    side: z.enum(["BASE", "HEAD"]),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
  })
  .refine((value) => value.end >= value.start && value.end - value.start < 100);

export const guidedPullSchema = z.object({
  id: identifier,
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  number: z.number().int().positive(),
  title: z.string(),
  url: z.url(),
  baseSha: sha,
  headSha: sha,
  mergeBaseSha: sha,
  files: z.array(
    z.object({
      path: sourcePathSchema,
      oldPath: sourcePathSchema,
      diff: z.string(),
      base: z.string().nullable(),
      head: z.string().nullable(),
    }),
  ),
});

export const guidedReportSchema = z.object({
  version: z.literal(1),
  reportId: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string(),
  pulls: z.array(guidedPullSchema).min(1).max(30),
  evidence: z.array(
    z.object({
      id: identifier,
      pr: identifier,
      path: sourcePathSchema,
      side: z.enum(["BASE", "HEAD"]),
      start: z.number().int().positive(),
      end: z.number().int().positive(),
      text: z.string(),
      quote: z.string(),
      sha,
    }),
  ),
  groups: z.array(
    z.object({
      id: identifier,
      title: z.string(),
      summary: z.string(),
      prs: z.array(identifier),
      evidence: z.array(identifier),
      files: z.array(z.object({ pr: identifier, path: sourcePathSchema })),
    }),
  ),
});

export const guidedNoteSchema = z.object({
  id: z.string().min(1).max(100),
  author: z.enum(["human", "agent"]),
  pr: identifier,
  anchor: z.string().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  originalBody: z.string().max(5000),
  quote: z.string().max(20_000),
  source: sourceRangeSchema.nullable(),
  evidence: z.array(identifier).max(20),
  selected: z.literal(true),
  dismissed: z.literal(false),
});

export const draftRequestSchema = z.object({
  reportId: z.string().regex(/^[a-f0-9]{64}$/),
  pr: identifier,
  notes: z.array(guidedNoteSchema).min(1).max(80),
});

export const preparedCommentSchema = z
  .strictObject({
    noteIds: z.array(z.string()).min(1).max(80),
    path: sourcePathSchema,
    side: z.enum(["LEFT", "RIGHT"]),
    startLine: z.number().int().positive(),
    line: z.number().int().positive(),
    body: z.string().trim().min(1).max(5000),
    quote: z.string().min(1).max(20_000),
  })
  .refine((value) => value.line >= value.startLine && value.line - value.startLine < 100);

export const preparedReviewSchema = z.strictObject({
  comments: z.array(preparedCommentSchema).max(80),
  held: z.array(z.strictObject({ id: z.string(), reason: z.string().min(1).max(1000) })).max(80),
});

export type GuidedReport = z.infer<typeof guidedReportSchema>;
export type GuidedPull = z.infer<typeof guidedPullSchema>;
export type GuidedNote = z.infer<typeof guidedNoteSchema>;
export type DraftRequest = z.infer<typeof draftRequestSchema>;
export type PreparedReview = z.infer<typeof preparedReviewSchema>;
export type PreparedComment = z.infer<typeof preparedCommentSchema>;
export type DraftResult = {
  readonly url: string | null;
  readonly stagedIds: readonly string[];
  readonly held: readonly { readonly id: string; readonly reason: string }[];
};
