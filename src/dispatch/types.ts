import type { ActionCapability, ActionTier } from "../config";
import type {
  EngineId,
  EngineRunner,
  PermissionDenial,
  PermissionMode,
} from "../engine";
import type { ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";
import type { CommandRunner } from "./command";
import type { GateReceipt, GateExecutor } from "./gate";

export type BlockedAction = ActionCapability | "force-push" | "merge";

export type ResolvedDispatchPolicy = {
  readonly allowedTools: readonly string[];
  readonly disallowedTools: readonly string[];
  readonly permissionMode: PermissionMode;
  readonly maxBudgetUsd: number;
  readonly grantedActions: readonly ActionCapability[];
  readonly blockedActions: readonly BlockedAction[];
  readonly allowedDomains: readonly string[];
};

export type RunReceipt = {
  readonly runId: string;
  readonly taskSlug: string;
  readonly taskHash: string;
  readonly repo: string;
  readonly branch: string;
  readonly engine: EngineId;
  readonly model: string | null;
  readonly sessionId: string;
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
  readonly gate: GateReceipt;
};

export type DispatchPolicyInput = {
  readonly configuredPolicy: {
    readonly allow: readonly ActionCapability[];
    readonly maxBudgetUsd: number;
  } | null;
  readonly approvedActions: readonly ActionCapability[];
  readonly managedActionTier: ActionTier;
};

export type RunOptions = {
  readonly task: string;
  readonly pullRequestNumber?: number;
  readonly targetDirectory?: string;
  readonly approvedActions?: readonly ActionCapability[];
  readonly configPath?: string;
  readonly managedConfigPath?: string | null;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly runner?: EngineRunner;
  readonly commandRunner?: CommandRunner;
  readonly gateExecutor?: GateExecutor;
  readonly runId?: string;
  readonly startedAt?: string;
};
