import type { OriginScope } from "../../signal";
import type { ProfileRule, ProfileSource, ProfileStatus } from "../types";

export type ProfileCompileInput =
  | {
      readonly kind: "directory";
      readonly profileDirectory: string;
      readonly origin: OriginScope;
      readonly targetRepo: string | null;
    }
  | {
      readonly kind: "rules";
      readonly rules: readonly ProfileRule[];
    };

export type ProfileCompilationOmissionReason =
  | "candidate"
  | "stale"
  | "axis-conflict"
  | "budget";

export type ProfileCompilationOmission = {
  readonly ruleKey: string | null;
  readonly reason: ProfileCompilationOmissionReason;
};

export type ProfileCompilation = {
  readonly markdown: string;
  readonly appliedRuleKeys: readonly string[];
  readonly appliedRuleCount: number;
  readonly omissions: readonly ProfileCompilationOmission[];
};

export type CompilerBlock = {
  readonly ruleKey: string | null;
  readonly source: ProfileSource;
  readonly status: ProfileStatus;
  readonly observations: number;
  readonly visible: string;
  readonly appliesWhen: readonly string[];
};
