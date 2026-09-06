import path from "node:path";
import type { ShadowcloneConfig } from "../../config";
import type { IndexedEvent } from "../../index";
import { resolveRedacted } from "../../redact";
import { extractPromptText } from "../prompt";
import type { Evidence } from "./types";

const evidenceKinds = new Set(["user-prompt", "question-answered"]);

export async function collectEvidence(options: {
  readonly events: readonly IndexedEvent[];
  readonly repository: string;
  readonly config: ShadowcloneConfig;
}): Promise<readonly Evidence[]> {
  const eligibleEvents = options.events
    .filter((event) => {
      const isSourceEnabled = options.config.sources[event.source];
      const hasCwd = event.cwd.length > 0;
      const isRepoMatch = path.resolve(event.cwd) === options.repository;
      const isEvidenceKind = evidenceKinds.has(event.kind);
      const hasText = event.textRef !== null;

      return (
        isSourceEnabled &&
        hasCwd &&
        isRepoMatch &&
        isEvidenceKind &&
        hasText
      );
    })
    .sort((left, right) => left.timestamp - right.timestamp || left.id - right.id);

  const evidenceList: Evidence[] = [];
  for (const event of eligibleEvents) {
    if (event.textRef === null) {
      continue;
    }

    const rawText = await resolveRedacted({ ref: event.textRef });
    const promptText = extractPromptText(rawText);

    if (promptText && promptText.length <= 12000) {
      evidenceList.push({
        id: `${event.source}:${event.id}`,
        sessionId: `${event.source}:${event.sessionId}`,
        timestamp: event.timestamp,
        text: promptText,
      });
    }
  }

  return evidenceList;
}

export function trainingEvidence(options: {
  readonly evidence: readonly Evidence[];
  readonly task: Evidence;
  readonly excludedSessions: ReadonlySet<string>;
}): readonly Evidence[] {
  return options.evidence
    .filter((entry) => {
      const isEarlier = entry.timestamp < options.task.timestamp;
      const isDifferentSession = entry.sessionId !== options.task.sessionId;
      const isNotExcluded = !options.excludedSessions.has(entry.sessionId);

      return isEarlier && isDifferentSession && isNotExcluded;
    })
    .slice(-30);
}
