import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { EngineRunner } from "../engine";
import {
  distillationMergeOutputSchema,
  parseDistilledRules,
  type DistilledRule,
} from "./schema";

export function mergeCheckpointId(rules: readonly DistilledRule[]): string {
  const identity = rules.map((rule) => ({
    title: rule.title,
    body: rule.body,
    section: rule.section,
  }));
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(identity))
    .digest("hex")
    .slice(0, 24);
}

export async function mergeDistilledRules(options: {
  readonly rules: readonly DistilledRule[];
  readonly runner: EngineRunner;
  readonly cwd: string;
  readonly maxBudgetUsd?: number;
  readonly checkpointDirectory?: string;
}): Promise<readonly DistilledRule[]> {
  if (options.rules.length <= 1) {
    return options.rules;
  }

  const checkpointPath = options.checkpointDirectory
    ? path.join(
        options.checkpointDirectory,
        `merge-${mergeCheckpointId(options.rules)}.json`,
      )
    : null;

  if (checkpointPath && (await Bun.file(checkpointPath).exists())) {
    try {
      const cached: unknown = await Bun.file(checkpointPath).json();
      return parseDistilledRules(cached);
    } catch {
      // Fall through to run
    }
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
    const parsed = parseDistilledRules(structured);
    if (checkpointPath) {
      await mkdir(path.dirname(checkpointPath), { recursive: true });
      await Bun.write(
        checkpointPath,
        `${JSON.stringify({ rules: parsed }, null, 2)}\n`,
      );
    }
    return parsed;
  } catch {
    return options.rules;
  }
}
