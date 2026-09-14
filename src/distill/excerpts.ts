import { extractPromptText } from "../eval/prompt";
import { stripManagedGuidance } from "../integrations";
import { textRefKey } from "../observe";
import { resolveRedacted } from "../redact";
import type { CorrectionSignal } from "../signal";

export const internalLearningMarker = "SHADOWCLONE_INTERNAL_LEARNING";

export async function materializeEvidence(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly sourceRoots?: readonly string[];
}): Promise<{
  readonly signals: readonly CorrectionSignal[];
  readonly excerpts: ReadonlyMap<string, string>;
}> {
  const excerpts = new Map<string, string>();
  const accepted: CorrectionSignal[] = [];
  for (const signal of options.signals) {
    const textRefs = [];
    for (const ref of signal.textRefs) {
      const redacted = await resolveRedacted({ ref, roots: options.sourceRoots });
      const text = signal.kind === "user-steering" ? extractPromptText(redacted) ?? "" : redacted;
      if (text.includes(internalLearningMarker) || text.trimStart().startsWith("# Shadowclone profile")) continue;
      const authored = stripManagedGuidance(text);
      if (!authored.trim()) continue;
      excerpts.set(textRefKey(ref), authored);
      textRefs.push(ref);
    }
    if (textRefs.length === 0) continue;
    for (const ref of signal.contextRefs ?? []) {
      const text = await resolveRedacted({ ref, roots: options.sourceRoots });
      excerpts.set(textRefKey(ref), extractPromptText(text) ?? "");
    }
    accepted.push({ ...signal, textRefs });
  }
  return { signals: accepted, excerpts };
}
