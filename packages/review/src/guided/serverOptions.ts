import type { GuidedGitHub } from "./github";
import type { GuidedEngine } from "./engine";

export type GuidedServerOptions = {
  readonly file: string;
  readonly checkout: string;
  readonly preferredEngine?: "claude-code" | "codex";
  readonly voiceFile?: string;
  readonly reviewSkill?: string;
  readonly model?: string;
  readonly receiptDirectory?: string;
  readonly github?: GuidedGitHub;
  readonly engine?: GuidedEngine | null;
  readonly login?: string;
  readonly port?: number;
  readonly managedConfigFile?: string | null;
};
