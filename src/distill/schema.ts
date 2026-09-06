import { z } from "zod";
import type { ProfileSection } from "../profile";

export type DistilledRule = {
  readonly title: string;
  readonly body: string;
  readonly section: ProfileSection;
  readonly sources?: readonly number[];
};

export const distillationOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rules"],
  properties: {
    rules: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "section"],
        properties: {
          title: { type: "string", maxLength: 120 },
          body: { type: "string", maxLength: 600 },
          section: {
            type: "string",
            enum: ["engineering", "workflow", "boundaries"],
          },
        },
      },
    },
  },
} as const;

export const distillationMergeOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rules"],
  properties: {
    rules: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "section"],
        properties: {
          title: { type: "string", maxLength: 120 },
          body: { type: "string", maxLength: 600 },
          section: {
            type: "string",
            enum: ["engineering", "workflow", "boundaries"],
          },
          sources: {
            type: "array",
            items: { type: "integer" },
          },
        },
      },
    },
  },
} as const;

const distilledRuleItemSchema = z.object({
  title: z.string(),
  body: z.string(),
  section: z.enum(["engineering", "workflow", "boundaries"]),
  sources: z.array(z.number().int().nonnegative()).optional(),
});

function normalizeText(value: string, maxLength: number): string {
  return value
    .replaceAll("<!--", "")
    .replaceAll("-->", "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function parseDistilledRules(value: unknown): readonly DistilledRule[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !("rules" in value) ||
    !Array.isArray(value.rules)
  ) {
    throw new Error("The engine returned an invalid distillation result");
  }

  return value.rules.flatMap((entry) => {
    const parsed = distilledRuleItemSchema.safeParse(entry);
    if (!parsed.success) {
      return [];
    }

    const title = normalizeText(parsed.data.title, 120);
    const body = normalizeText(parsed.data.body, 600);
    if (!title || !body) {
      return [];
    }

    return [
      {
        title,
        body,
        section: parsed.data.section,
        ...(parsed.data.sources ? { sources: parsed.data.sources } : {}),
      },
    ];
  });
}
