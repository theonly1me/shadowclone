import type { ProfileSection } from "../profile";

export type DistilledRule = {
  readonly title: string;
  readonly body: string;
  readonly section: ProfileSection;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: string, maxLength: number): string {
  return value
    .replaceAll("<!--", "")
    .replaceAll("-->", "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseSection(value: unknown): ProfileSection | null {
  return value === "engineering" ||
    value === "workflow" ||
    value === "boundaries"
    ? value
    : null;
}

export function parseDistilledRules(value: unknown): readonly DistilledRule[] {
  if (!isRecord(value) || !Array.isArray(value.rules)) {
    throw new Error("The engine returned an invalid distillation result");
  }
  return value.rules.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const section = parseSection(entry.section);
    if (
      typeof entry.title !== "string" ||
      typeof entry.body !== "string" ||
      section === null
    ) {
      return [];
    }
    const title = normalizeText(entry.title, 120);
    const body = normalizeText(entry.body, 600);
    return title && body ? [{ title, body, section }] : [];
  });
}
