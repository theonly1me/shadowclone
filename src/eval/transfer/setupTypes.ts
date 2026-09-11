import type { ManagedPolicy, ShadowcloneConfig } from "../../config";
import type { EngineId, EngineRunner } from "../../engine";
import type { ProjectPaths } from "../../paths";
import type { TransferReceipt } from "./types";

export interface ResolvedTransferSetup {
  readonly paths: ProjectPaths;
  readonly config: ShadowcloneConfig;
  readonly policy: ManagedPolicy;
  readonly repository: string;
  readonly evalId: string;
  readonly directory: string;
  readonly saved: TransferReceipt | null;
  readonly engine: EngineId;
  readonly runner: EngineRunner;
  readonly model: string;
  readonly count: number;
  readonly repeat: number;
  readonly timeoutSeconds: number;
  readonly maxBudgetUsd: number | undefined;
  readonly since: number;
}
