import type { EngineId, ReasoningEffort } from "./types";

export type FastTier = {
  readonly model: string | null;
  readonly reasoningEffort: ReasoningEffort | null;
  readonly thinking?: "off";
  readonly systemPrompt?: string;
  readonly source: string;
};

export const fastSystemPrompt =
  "You answer requests from Shadowclone, a local tool. Reply with exactly the JSON that the request asks for. You have no tools.";

const fastTiers: Readonly<Partial<Record<EngineId, FastTier>>> = {
  "claude-code": {
    model: "haiku",
    reasoningEffort: "high",
    thinking: "off",
    systemPrompt: fastSystemPrompt,
    source: "the Claude Code alias for the current Haiku model, Haiku 5.5 on the Anthropic API",
  },
  codex: {
    model: "gpt-6-luna",
    reasoningEffort: "high",
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
