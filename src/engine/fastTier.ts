import type { EngineId, ReasoningEffort } from "./types";

export type FastTier = {
  readonly model: string | null;
  readonly reasoningEffort: ReasoningEffort | null;
  readonly source: string;
};

const fastTiers: Readonly<Partial<Record<EngineId, FastTier>>> = {
  "claude-code": {
    model: "haiku",
    reasoningEffort: "low",
    source: "the Claude Code model alias for the current Haiku model",
  },
  codex: {
    model: "gpt-6-luna",
    reasoningEffort: "low",
    source: "a model preset in codex-cli 0.159.0",
  },
};

export function fastTier(options: {
  readonly engine: EngineId;
  readonly savedModel: string | undefined;
}): FastTier {
  return (
    fastTiers[options.engine] ?? {
      model: options.engine === "pi" ? (options.savedModel ?? null) : null,
      reasoningEffort: null,
      source:
        options.engine === "pi" ? "the saved Pi model" : "the default model of the engine",
    }
  );
}
