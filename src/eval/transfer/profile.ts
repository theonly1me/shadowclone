import path from "node:path";
import { distillSignals } from "../../distill";
import type { EngineId } from "../../engine";
import type { IndexedEvent } from "../../index";
import { deriveSignals } from "../../signal";
import type { Evidence, ModelCall } from "./types";

export async function learnEvaluationProfile(options: {
  readonly events: readonly IndexedEvent[];
  readonly training: readonly Evidence[];
  readonly cutoff: number;
  readonly call: ModelCall;
  readonly engine: EngineId;
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

  const distilled = await distillSignals({
    events,
    signals: derived.corrections,
    runner: (run) =>
      options.call({
        cwd: options.directory,
        prompt: run.prompt,
        outputSchema: run.outputSchema,
      }),
    engine: options.engine,
    workingDirectory: options.directory,
    checkpointDirectory: path.join(options.directory, crypto.randomUUID()),
  });

  const renderedRules = distilled.rules
    .filter((rule) => rule.status === "active")
    .map(
    (rule) => `## ${rule.title}\n\n${rule.body}`,
    );
  return renderedRules.length === 0
    ? "# Shadowclone profile\n"
    : `# Shadowclone profile\n\n${renderedRules.join("\n\n")}\n`;
}
