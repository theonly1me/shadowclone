import type { ManagedPolicy, ShadowcloneConfig } from "../../config";
import type {
  EngineId,
  EngineRunner,
  ReasoningEffort,
} from "../../engine";
import type { ProjectPaths } from "../../paths";
import type { RepositoryIdentity } from "../../signal";
import type { TransferReceipt } from "./types";

export interface ResolvedTransferSetup {
  readonly paths: ProjectPaths;
  readonly config: ShadowcloneConfig;
  readonly policy: ManagedPolicy;
  readonly repository: string;
  readonly repositoryIdentity: RepositoryIdentity;
  readonly evalId: string;
  readonly directory: string;
  readonly saved: TransferReceipt | null;
  readonly engine: EngineId;
  readonly runner: EngineRunner;
  readonly model: string;
  readonly reasoningEffort: ReasoningEffort | undefined;
  readonly count: number;
  readonly repeat: number;
  readonly timeoutSeconds: number;
  readonly maxBudgetUsd: number | undefined;
  readonly maxCalls: number;
  readonly suppliedTask: string | undefined;
  readonly taskFile: string | undefined;
  readonly suiteId: string | undefined;
}

export function positiveInteger(options: {
  readonly value: number | undefined;
  readonly fallback: number;
  readonly name: string;
}): number {
  const value = options.value ?? options.fallback;

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${options.name} must be a positive integer`);
  }

  return value;
}
