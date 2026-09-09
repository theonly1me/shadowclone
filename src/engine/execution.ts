import type { EngineRunOptions } from "./types";

export function isIsolatedExecution(options: EngineRunOptions): boolean {
  return options.execution.purpose !== "dispatch";
}

export function validateEngineExecution(options: EngineRunOptions): void {
  if (options.execution.purpose !== "learning") {
    return;
  }
  if (options.systemPromptFile !== undefined) {
    throw new Error("Learning cannot load a system prompt file");
  }
  if (options.allowedTools && options.allowedTools.length > 0) {
    throw new Error("Learning cannot enable provider tools");
  }
  if (
    options.permissionMode !== undefined &&
    options.permissionMode !== "dontAsk"
  ) {
    throw new Error("Learning requires the dontAsk permission mode");
  }
}
