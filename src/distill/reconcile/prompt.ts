import { resolveRedacted } from "../../redact";
import type {
  PromptEvidence,
  PromptRule,
  ReconciliationContext,
} from "./types";

function ruleText(rule: PromptRule): string {
  const options = rule.axisOptions.flatMap((option) => [
    `Sibling ${option.token}: ${option.title}`,
    option.body,
    `Applies when: ${option.appliesWhen.join(", ")}`,
  ]);
  return [
    `${rule.token} [${rule.snapshot.rule.source}, ${rule.snapshot.rule.status}]`,
    rule.snapshot.promptTitle,
    rule.snapshot.promptBody,
    `Applies when: ${rule.snapshot.promptAppliesWhen.join(", ") || "always"}`,
    `Evidence: ${rule.snapshot.rule.evidence.for.length} supporting, ${rule.snapshot.rule.evidence.against.length} contradicting`,
    ...(rule.snapshot.promptProposal
      ? [
          `Pending ${rule.snapshot.promptProposal.kind}: ${rule.snapshot.promptProposal.text}`,
        ]
      : []),
    ...options,
  ].join("\n");
}

async function evidenceText(options: {
  readonly evidence: PromptEvidence;
  readonly maxExcerptCharacters: number;
  readonly sourceRoots?: readonly string[];
}): Promise<string> {
  const excerpts: string[] = [];
  for (const ref of options.evidence.signal.textRefs) {
    const text = await resolveRedacted({ ref, roots: options.sourceRoots });
    if (text.length > 0) {
      excerpts.push(text.slice(0, options.maxExcerptCharacters));
    }
  }
  return [
    `${options.evidence.token} [${options.evidence.signal.kind}]`,
    `Pattern: ${options.evidence.signal.label}`,
    ...excerpts.map((excerpt) => `Excerpt:\n${excerpt}`),
  ].join("\n");
}

export async function buildReconciliationPrompt(options: {
  readonly context: ReconciliationContext;
  readonly maxExcerptCharacters?: number;
  readonly sourceRoots?: readonly string[];
}): Promise<string> {
  const evidence = await Promise.all(
    options.context.evidence.map((entry) =>
      evidenceText({
        evidence: entry,
        sourceRoots: options.sourceRoots,
        maxExcerptCharacters: options.maxExcerptCharacters ?? 4_000,
      }),
    ),
  );
  const rejections = options.context.rejections.map((entry) =>
    [
      entry.token,
      entry.snapshot.promptTitle ?? "Untitled rejected guidance",
      entry.snapshot.promptBody ?? "",
    ].join("\n"),
  );
  return [
    "Reconcile correction evidence with the user's existing behavioral guidance.",
    "For each affected existing rule, return reinforces, contradicts, or narrows and only the evidence tokens that support that verdict.",
    "Keep existing wording unchanged. For disagreement, select a sibling option token when one fits, otherwise propose replacement wording.",
    "Return genuinely new reusable guidance separately. Name a rejection token when it is semantically equivalent to rejected guidance.",
    "Use only the supplied opaque tokens and return JSON matching the schema.",
    "",
    "Existing guidance",
    options.context.rules.map(ruleText).join("\n\n") || "None",
    "",
    "Rejected guidance",
    rejections.join("\n\n") || "None",
    "",
    "Correction evidence",
    evidence.join("\n\n"),
  ].join("\n");
}
