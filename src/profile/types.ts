export type ProfileSection = "engineering" | "workflow" | "boundaries";
export type ProfileScope = "global" | "org";

export type ProfileRule = {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly section: ProfileSection;
  readonly scope: ProfileScope;
  readonly originDirectory: string | null;
  readonly observations: number;
  readonly confidence: number;
  readonly lastSeen: string;
  readonly sessions: number;
  readonly origins: readonly string[];
};

export type ExistingProfileRule = {
  readonly key: string;
  readonly fingerprint: string;
  readonly content: string;
  readonly edited: boolean;
};

export type ExistingProfileBlock =
  | ExistingProfileRule
  | {
      readonly key: null;
      readonly content: string;
      readonly edited: true;
    };

export type ProfileWriteResult = {
  readonly files: number;
  readonly rules: number;
  readonly rejected: number;
};
