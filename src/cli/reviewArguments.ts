import { reasoningEfforts, type ReasoningEffort } from "../engine/types";

export type LocalReviewArguments = {
  readonly number: number;
  readonly repository: string | null;
  readonly runChecks: boolean;
  readonly network: boolean;
  readonly cloud: boolean;
  readonly output: string | null;
  readonly model: string;
  readonly effort: ReasoningEffort | null;
};

export const defaultReviewModel = "claude-opus-5-5";

export const reviewUsage =
  "Use shadowclone review <pr-number> [--cloud] [--no-checks] [--offline] [--repo owner/repository] [--output file.md] [--model id] [--effort level].";

const valueFlags = ["--repo", "--output", "--model", "--effort"] as const;
const switchFlags = ["--cloud", "--no-checks", "--offline"] as const;

function isReasoningEffort(value: string): value is ReasoningEffort {
  return reasoningEfforts.some((effort) => effort === value);
}

export function parseReviewArguments(arguments_: readonly string[]): LocalReviewArguments {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  const positionals: string[] = [];

  for (let position = 0; position < arguments_.length; position += 1) {
    const argument = arguments_[position] ?? "";

    if (switchFlags.some((flag) => flag === argument)) {
      switches.add(argument);
      continue;
    }

    if (valueFlags.some((flag) => flag === argument)) {
      const value = arguments_[position + 1];

      if (value === undefined || values.has(argument)) {
        throw new Error(reviewUsage);
      }

      values.set(argument, value);
      position += 1;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(reviewUsage);
    }

    positionals.push(argument);
  }

  const [numberText, ...extra] = positionals;
  const number = Number(numberText);
  const repository = values.get("--repo") ?? null;
  const effort = values.get("--effort") ?? null;

  if (extra.length > 0 || !Number.isInteger(number) || number <= 0) {
    throw new Error(reviewUsage);
  }

  if (repository !== null && !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error(reviewUsage);
  }

  if (effort !== null && !isReasoningEffort(effort)) {
    throw new Error(`Choose an effort from ${reasoningEfforts.join(", ")}.`);
  }

  return {
    number,
    repository,
    runChecks: !switches.has("--no-checks"),
    network: !switches.has("--offline"),
    cloud: switches.has("--cloud"),
    output: values.get("--output") ?? null,
    model: values.get("--model") ?? defaultReviewModel,
    effort,
  };
}
