export type EngineId =
  | "claude-code"
  | "codex"
  | "cursor-agent"
  | "antigravity"
  | "anthropic-api"
  | "openai-compatible";

export type PermissionMode =
  | "acceptEdits"
  | "default"
  | "dontAsk"
  | "manual"
  | "plan"
  | "auto";

export type PermissionDenial = {
  readonly toolName: string;
  readonly toolUseId: string | null;
};

export type EngineAction = {
  readonly tool: string;
  readonly path: string | null;
  readonly command?: string | null;
};

export type EngineRunOptions = {
  readonly prompt: string;
  readonly cwd: string;
  readonly systemPromptFile?: string;
  readonly sessionId?: string;
  readonly model?: string;
  readonly allowedTools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly permissionMode?: PermissionMode;
  readonly maxBudgetUsd?: number;
  readonly outputSchema?: unknown;
  readonly signal?: AbortSignal;
};

export type EngineRun = {
  readonly engine: EngineId;
  readonly sessionId: string;
  readonly transcriptPath: string | null;
  readonly text: string;
  readonly structured: unknown;
  readonly costUsd: number | null;
  readonly durationMs: number;
  readonly turns: number;
  readonly isError: boolean;
  readonly permissionDenials: readonly PermissionDenial[];
  readonly actions?: readonly EngineAction[];
  readonly errorMessage?: string | null;
};

export type EngineRunner = (
  options: EngineRunOptions,
) => Promise<EngineRun>;

export type EngineAvailability = {
  readonly engine: EngineId;
  readonly installed: boolean;
  readonly authenticated: boolean;
};
