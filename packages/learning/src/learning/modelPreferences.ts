import type { EngineId } from "@shadowclone/agents";

export type LearningPreferences = {
  readonly engine?: EngineId;
  readonly model?: string;
};

export function selectLearningPreferences(options: {
  readonly explicit?: LearningPreferences;
  readonly triggered?: LearningPreferences;
  readonly saved?: LearningPreferences;
}): LearningPreferences {
  const triggeredWithHarness = options.triggered?.engine ? options.triggered : undefined;
  const preferences = [options.explicit, triggeredWithHarness, options.saved];
  const engine = preferences.find(preference => preference?.engine)?.engine;
  const model = preferences.find(preference => preference?.model &&
    (!preference.engine || preference.engine === engine))?.model;
  return { ...(engine ? { engine } : {}), ...(model ? { model } : {}) };
}
