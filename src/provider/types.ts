import type { SourceId } from "../config";
import type { EngineId } from "../engine/types";

export type StructuredOutputSupport = "native" | "prompted" | "none";

export type EngineCapabilities = {
  readonly structuredOutput: StructuredOutputSupport;
  readonly callerSessionId: boolean;
  readonly maxBudgetUsd: boolean;
  readonly granularToolPolicy: boolean;
  readonly isolatedNoTools: boolean;
};

export type ProviderEngine = {
  readonly id: EngineId;
  readonly implemented: boolean;
  readonly capabilities: EngineCapabilities;
};

export type TranscriptFormat = "jsonl" | "sqlite" | "sqlite-protobuf";

export type ProviderDefinition = {
  readonly id: ProviderId;
  readonly captureSource: SourceId | null;
  readonly engine: ProviderEngine | null;
  readonly transcriptFormat: TranscriptFormat | null;
};

export type ProviderSupport = {
  readonly observe: boolean;
  readonly distill: boolean;
  readonly dispatch: boolean;
};

export type EnginePurpose = "distill" | "dispatch" | "eval";

export const providerIds = [
  "claude-code",
  "codex",
  "cursor",
  "antigravity",
] as const;

export type ProviderId = (typeof providerIds)[number];

function supportsDistillation(engine: ProviderEngine | null): boolean {
  return (
    engine?.implemented === true &&
    engine.capabilities.structuredOutput !== "none" &&
    engine.capabilities.isolatedNoTools
  );
}

export function getProviderSupport(
  definition: ProviderDefinition,
): ProviderSupport {
  const distill = supportsDistillation(definition.engine);
  const engineImplemented = definition.engine?.implemented === true;
  const capabilities = definition.engine?.capabilities;
  return {
    observe: definition.captureSource !== null,
    distill,
    dispatch:
      engineImplemented &&
      capabilities?.callerSessionId === true &&
      capabilities.maxBudgetUsd &&
      capabilities.granularToolPolicy,
  };
}

export function providerSupportsPurpose(options: {
  readonly definition: ProviderDefinition;
  readonly purpose: EnginePurpose;
}): boolean {
  if (options.purpose === "eval") {
    return options.definition.engine?.implemented === true &&
      new Set(["claude-code", "codex"]).has(options.definition.engine.id);
  }
  const support = getProviderSupport(options.definition);
  return options.purpose === "distill" ? support.distill : support.dispatch;
}
