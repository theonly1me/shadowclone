import type { EngineRun } from "../engine/types";

export function engineRun(overrides: Partial<EngineRun>): EngineRun {
  return {
    engine: "claude-code",
    sessionId: "session",
    transcriptPath: null,
    text: "",
    structured: { findings: [], dropped: [] },
    costUsd: 0.5,
    durationMs: 10,
    turns: 2,
    isError: false,
    permissionDenials: [],
    actions: [],
    errorMessage: null,
    ...overrides,
  };
}
