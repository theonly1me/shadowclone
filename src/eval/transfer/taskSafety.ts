import {
  additiveTaskExclusionReason,
  candidateExclusionReason,
} from "./candidateValidation";

const forbiddenTask =
  /\b(?:commit|amend|push|deploy|production|staging|external service|network access|install (?:a |any )?(?:package|dependency)|database migration)\b/i;

export function invalidTaskReason(task: {
  readonly prompt: string;
  readonly completion: readonly string[];
  readonly preferences: readonly { readonly requirement: string }[];
  readonly additive: boolean;
}): string | null {
  if (forbiddenTask.test([task.prompt, ...task.completion].join("\n"))) {
    return "Task requires a forbidden external or permanent action";
  }

  const candidateReason = candidateExclusionReason({
    prompt: task.prompt,
    completion: task.completion,
    preferences: task.preferences,
  });

  if (candidateReason) {
    return candidateReason;
  }

  if (task.additive) {
    const additiveReason = additiveTaskExclusionReason(task);

    if (additiveReason) {
      return additiveReason;
    }
  }

  return null;
}
