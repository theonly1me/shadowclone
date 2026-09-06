import path from "node:path";
import { distillSignals } from "../../distill";
import type { IndexedEvent } from "../../index";
import { buildProfileRules } from "../../profile";
import { deriveSignals } from "../../signal";
import type { Evidence, ModelCall } from "./types";

export async function learnEvaluationProfile(options: {
  readonly events: readonly IndexedEvent[];
  readonly training: readonly Evidence[];
  readonly cutoff: number;
  readonly call: ModelCall;
  readonly directory: string;
}): Promise<string> {
  const sessions = new Set(options.training.map((entry) => entry.sessionId));

  const events = options.events.filter(
    (event) =>
      event.timestamp < options.cutoff &&
      sessions.has(`${event.source}:${event.sessionId}`),
  );

  const derived = await deriveSignals({
    events,
    gitMetadataEnabled: false,
    corpus: { sessions: sessions.size, bytes: 0, activeDays: 0 },
  });

  const structuralRules = buildProfileRules({
    events,
    signals: derived.corrections,
    origins: derived.origins,
  });

  const distilled = await distillSignals({
    events,
    signals: derived.corrections,
    runner: (run) =>
      options.call({
        cwd: options.directory,
        prompt: run.prompt,
        outputSchema: run.outputSchema,
      }),
    workingDirectory: options.directory,
    checkpointDirectory: path.join(options.directory, crypto.randomUUID()),
  });

  const rules =
    distilled.rules.length > 0 ? distilled.rules : structuralRules;

  return `# Shadowclone profile\n\n${rules.map((rule) => `## ${rule.title}\n\n${rule.body}`).join("\n\n")}\n`;
}
