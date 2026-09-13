const analysisRequest =
  /(?:^|[.!?]\s+|\n+)\s*(?:(?:please\s+)?(?:can|could|would)\s+you\s+)?(?:review|investigate|analy[sz]e|explain|plan|summarize|compare|what|why|how)\b/i;
const directImplementationRequest =
  /(?:^|[.!?]\s+|\n+)\s*(?:(?:please\s+)?(?:can|could|would)\s+you\s+)?(?:implement|fix|add|update|change|remove|refactor|create|write|migrate|rename|replace|address|resolve|clean up|support|ship|build)\b/i;
const statedImplementationRequest =
  /\b(?:i (?:want|need)(?: you)? to|we need to|let['’]?s)\s+(?:implement|fix|add|update|change|remove|refactor|create|write|migrate|rename|replace|address|resolve|clean up|support|ship|build)\b/i;
const productOutcomeRequest =
  /\b(?:what (?:i|we) (?:actually |do )?want|(?:users?|customers?|agents?|the (?:ui|api|mcp)|ui|api|mcp) should)\b/i;

export function candidateExclusionReason(options: {
  readonly prompt: string;
  readonly completion: readonly string[];
  readonly preferences: readonly unknown[];
}): string | null {
  const taskText = [options.prompt, ...options.completion].join("\n");
  const readOnlyDirective =
    /\b(?:read[- ]only|no (?:code|file|repository) changes?|(?:do not|don't|must not) (?:modify|edit|change|write) (?:anything|any files?|repository files?|code)|without (?:modifying|editing|changing) (?:anything|any files?|repository files?|code))\b/i;
  if (readOnlyDirective.test(taskText)) {
    return "Candidate is read-only and has no verifiable repository outcome";
  }
  if (
    analysisRequest.test(options.prompt) &&
    !directImplementationRequest.test(options.prompt) &&
    !statedImplementationRequest.test(options.prompt) &&
    !productOutcomeRequest.test(options.prompt)
  ) {
    return "Candidate requests analysis without a repository outcome";
  }
  if (options.completion.length === 0) {
    return "Preparation model returned no completion requirements";
  }
  if (options.preferences.length === 0) {
    return "Preparation model returned no preference requirements";
  }
  return null;
}

export function additiveTaskExclusionReason(options: {
  readonly prompt: string;
  readonly preferences: readonly unknown[];
}): string | null {
  const createsNewCode = /\b(?:add|create|implement|write)\b/i.test(
    options.prompt,
  ) && /\bnew\b/i.test(options.prompt);
  const namesCodeAndTests = /\b(?:module|function|utility|class)\b/i.test(
    options.prompt,
  ) && /\btests?\b/i.test(options.prompt);
  if (!createsNewCode || !namesCodeAndTests) {
    return "Generated task must create new code and focused tests";
  }
  if (options.preferences.length < 3) {
    return "Generated task needs at least three applicable preferences";
  }
  return null;
}
