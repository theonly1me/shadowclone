import type { CopiedCase } from "../copy";

export const armNames = ["shadowclone", "openqodex", "greptile"] as const;

export type ArmName = (typeof armNames)[number];

export type ArmRun = {
  readonly arm: ArmName;
  readonly caseId: string;
  readonly number: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly status: "done" | "timed-out" | "failed";
  readonly detail: string;
  readonly raw: unknown;
};

export type ArmRunner = (options: { readonly entry: CopiedCase; readonly evalRepository: string; readonly directory: string }) => Promise<ArmRun>;
