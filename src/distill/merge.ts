import type { EngineRunner } from "../engine";
import {
  distillationMergeOutputSchema,
  parseDistilledRules,
  type DistilledRule,
} from "./schema";

export async function mergeDistilledRules(options: {
  readonly rules: readonly DistilledRule[];
  readonly runner: EngineRunner;
  readonly cwd: string;
  readonly maxBudgetUsd?: number;
}): Promise<readonly DistilledRule[]> {
  if (options.rules.length <= 1) {
    return options.rules;
  }

  const prompt = [
    "You are an expert engineer. Below is a list of behavioral rules extracted from agent transcripts.",
    "Many of these rules are duplicates, restatements, or overlap significantly.",
    "Merge the duplicates into single, strong rules. Drop any rules that are content-free telemetry.",
    "For each consolidated rule, include a `sources` array with the 0-based integer indices of the input rules it consolidated.",
    "Output the consolidated set of rules as JSON matching the supplied schema.",
    "",
    ...options.rules.map(
      (rule, index) =>
        `[${index}] Title: ${rule.title}\nBody: ${rule.body}\nSection: ${rule.section}\n`,
    ),
  ].join("\n");

  const outputSchema = {
    ...distillationMergeOutputSchema,
    properties: {
      rules: {
        ...distillationMergeOutputSchema.properties.rules,
        maxItems: options.rules.length,
      },
    },
  };

  const run = await options.runner({
    prompt,
    cwd: options.cwd,
    allowedTools: [],
    permissionMode: "dontAsk",
    outputSchema,
    maxBudgetUsd: options.maxBudgetUsd,
  });

  if (run.isError) {
    return options.rules;
  }

  let structured = run.structured;
  if (!structured) {
    try {
      structured = JSON.parse(run.text);
    } catch {
      return options.rules;
    }
  }

  try {
    return parseDistilledRules(structured);
  } catch {
    return options.rules;
  }
}
