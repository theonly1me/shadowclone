export type ProfileSection = "engineering" | "workflow" | "boundaries";
export type ProfileScope = "global" | "org";
export type ProfileSource = "declared" | "imported" | "mined" | "user";
export type ProfileStatus = "active" | "candidate" | "stale";
export type ProfileProposalKind = "revise" | "narrow" | "retire";

export type ProfileProposal = {
  readonly kind: ProfileProposalKind;
  readonly text: string;
};

export type ProfileEvidence = {
  readonly for: readonly string[];
  readonly against: readonly string[];
};

export type ProfileRule = {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly section: ProfileSection;
  readonly scope: ProfileScope;
  readonly originDirectory: string | null;
  readonly source: ProfileSource;
  readonly status: ProfileStatus;
  readonly proposal: ProfileProposal | null;
  readonly appliesWhen: readonly string[];
  readonly evidence: ProfileEvidence;
  readonly observations: number;
  readonly lastSeen: string;
  readonly sessions: number;
  readonly origins: readonly string[];
};

export type ExistingProfileRule = {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly source: ProfileSource;
  readonly status: ProfileStatus;
  readonly proposal: ProfileProposal | null;
  readonly appliesWhen: readonly string[];
  readonly evidence: ProfileEvidence;
  readonly observations: number;
  readonly lastSeen: string;
  readonly sessions: number;
  readonly origins: readonly string[];
  readonly scope: ProfileScope;
  readonly fingerprint: string;
  readonly content: string;
  readonly edited: boolean;
  readonly legacy: boolean;
};

export type ExistingProfileBlock =
  | ExistingProfileRule
  | {
      readonly key: null;
      readonly content: string;
      readonly edited: true;
      readonly source: "user";
      readonly status: "active";
    };

export type ProfileRuleReference = {
  readonly relativePath: string;
  readonly key: string;
};

export type ProfileWriteResult = {
  readonly files: number;
  readonly rules: number;
  readonly rejected: number;
};
