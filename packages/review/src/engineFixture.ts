import type { EngineRun } from "@shadowclone/agents";
import type { ReviewLensSetting } from "./analyze";
import type { Coverage } from "./types";

export const lensesOff: ReviewLensSetting = { enabled: false };

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

export function promptHunks(prompt: string): readonly string[] {
  const block = /<hunks>\n([\s\S]*?)\n<\/hunks>/.exec(prompt)?.[1] ?? "";

  return block.split("\n").flatMap((line) => {
    const id = /^(H\d+) /.exec(line)?.[1];

    return id === undefined ? [] : [id];
  });
}

export function fullCoverage(prompt: string): readonly Coverage[] {
  return promptHunks(prompt).map((hunk) => ({ hunk, result: "clear", note: "Read the hunk and its callers." }));
}

export function coveredAnswer(options: { readonly answer: object; readonly prompt: string }): object {
  return { coverage: fullCoverage(options.prompt), ...options.answer };
}
