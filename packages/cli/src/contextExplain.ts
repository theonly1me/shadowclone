import type { ContextCompilation } from "@shadowclone/environment";

export function renderStartupContextSummary(
  context: ContextCompilation | null,
): string {
  if (context === null) {
    return "Session-start context: disabled by policy.";
  }

  return `Session-start context here: ${context.skills.length} skill(s), ${context.usedBytes}/${context.byteBudget} bytes.`;
}
