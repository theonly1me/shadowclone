import { z } from "zod";
import type { ReviewContext } from "../collect";
import type { RuleHit } from "../rules";
import type { CommandReport } from "../toolchain";
import { lineRangeSchema, pullFactsSchema, severities } from "../types";

const commitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const pathSchema = z.string().min(1).max(500);
const lineSchema = z.number().int().positive();

const diffFileSchema = z.object({
  path: pathSchema,
  deleted: z.boolean(),
  text: z.string().max(4_000_000),
  changedLines: z.number().int().nonnegative(),
  ranges: z.array(lineRangeSchema),
  added: z.array(z.object({ line: lineSchema, text: z.string() })),
});

const ruleHitSchema = z.object({
  ruleId: z.string().max(100),
  level: z.enum(["certain", "signal"]),
  severity: z.enum(severities),
  category: z.enum(["security", "correctness"]),
  title: z.string().max(200),
  failure: z.string().max(1000),
  path: pathSchema,
  line: lineSchema,
});

export const packetFileSchema = z.object({
  version: z.literal(1),
  context: z.object({
    facts: pullFactsSchema,
    files: z.array(diffFileSchema).max(5_000),
    standards: z.object({
      documents: z.array(z.object({ path: pathSchema, text: z.string().max(100_000) })),
      omitted: z.array(pathSchema),
    }),
    history: z.string().max(200_000),
  }),
  ruleHits: z.array(ruleHitSchema).max(100),
});

export type PacketFile = {
  readonly version: 1;
  readonly context: ReviewContext;
  readonly ruleHits: readonly RuleHit[];
};

export const checksFileSchema = z.object({
  version: z.literal(1),
  headSha: commitShaSchema,
  reports: z
    .array(
      z.object({
        stack: z.string().max(50),
        tool: z.string().max(50),
        status: z.enum(["ran", "skipped", "failed", "timed-out"]),
        detail: z.string().max(2_000),
        diagnostics: z
          .array(z.object({ tool: z.string().max(50), path: pathSchema, line: lineSchema, message: z.string().max(2_000) }))
          .max(50),
      }),
    )
    .max(50),
});

export type ChecksFile = {
  readonly version: 1;
  readonly headSha: string;
  readonly reports: readonly CommandReport[];
};
