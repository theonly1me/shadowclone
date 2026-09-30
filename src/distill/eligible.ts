import { readEffectiveConfig, type ShadowcloneConfig } from "../config";
import type { IndexedEvent } from "../index";
import { textRefKey } from "../observe";
import type { ProjectPaths } from "../paths";
import type { CorrectionSignal } from "../signal";

const eligibleKinds = new Set<IndexedEvent["kind"]>([
  "user-prompt",
  "plan-presented",
  "plan-resolved",
  "question-asked",
  "question-answered",
  "permission-denied",
  "interruption",
]);

export function authorizedLearningEvents(options: {
  readonly events: readonly IndexedEvent[];
  readonly config: ShadowcloneConfig;
}): readonly IndexedEvent[] {
  return options.events.filter((event) => options.config.sources[event.source]);
}

export function currentEvidenceAuthorization(options: {
  readonly paths: ProjectPaths;
  readonly configPath?: string;
  readonly events: readonly IndexedEvent[];
  readonly managedConfigPath?: string | null;
}): (ref: CorrectionSignal["textRefs"][number]) => Promise<boolean> {
  const sources = new Map(options.events.flatMap((event) =>
    event.textRef === null ? [] : [[textRefKey(event.textRef), event.source] as const]
  ));

  return async (ref) => {
    const source = sources.get(textRefKey(ref));

    if (!source) {
      return false;
    }

    const { config } = await readEffectiveConfig({
      configPath: options.configPath ?? options.paths.configFile,
      managedConfigPath: options.managedConfigPath === undefined
        ? options.paths.managedConfigFile
        : options.managedConfigPath,
    });

    return config.sources[source];
  };
}

export function isEligibleForDistillation(event: IndexedEvent): boolean {
  return eligibleKinds.has(event.kind) && event.textRef !== null;
}

export function allowlistedSignals(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly events: readonly IndexedEvent[];
}): readonly CorrectionSignal[] {
  const independentlyEligibleReferences = new Set(
    options.events.flatMap((event) =>
      isEligibleForDistillation(event) && event.textRef
        ? [textRefKey(event.textRef)]
        : [],
    ),
  );

  const assistantReferences = new Set(
    options.events.flatMap((event) =>
      event.kind === "assistant-text" && event.textRef
        ? [textRefKey(event.textRef)]
        : [],
    ),
  );

  return options.signals.map((signal) => ({
    ...signal,
    contextRefs: (signal.contextRefs ?? []).filter((ref) =>
      assistantReferences.has(textRefKey(ref)),
    ),
    textRefs: signal.textRefs.filter((ref) => {
      const key = textRefKey(ref);

      return (
        independentlyEligibleReferences.has(key) || assistantReferences.has(key)
      );
    }),
  }));
}
