import type {
  ActionCapability,
  ActionTier,
} from "../config";
import type {
  EngineId,
  PermissionDenial,
  PermissionMode,
} from "../engine";

export type BlockedAction =
  | ActionCapability
  | "force-push"
  | "merge";

export type ResolvedDispatchPolicy = {
  readonly allowedTools: readonly string[];
  readonly disallowedTools: readonly string[];
  readonly permissionMode: PermissionMode;
  readonly maxBudgetUsd: number;
  readonly requireCleanExit: boolean;
  readonly grantedActions: readonly ActionCapability[];
  readonly blockedActions: readonly BlockedAction[];
};

export type RunReceipt = {
  readonly runId: string;
  readonly task: string;
  readonly repo: string;
  readonly branch: string;
  readonly engine: EngineId;
  readonly model: string | null;
  readonly sessionId: string;
  readonly transcriptPath: string | null;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly costUsd: number | null;
  readonly turns: number;
  readonly filesChanged: readonly string[];
  readonly commits: readonly string[];
  readonly actionsTaken: readonly string[];
  readonly actionsBlockedByPolicy: readonly BlockedAction[];
  readonly permissionDenials: readonly PermissionDenial[];
  readonly profileRulesApplied: number;
};

export type DispatchPolicyInput = {
  readonly configuredPolicy:
    | {
        readonly allow: readonly ActionCapability[];
        readonly maxBudgetUsd: number;
        readonly requireCleanExit: boolean;
      }
    | null;
  readonly approvedActions: readonly ActionCapability[];
  readonly managedActionTier: ActionTier;
};
