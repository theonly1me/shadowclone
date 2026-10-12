export type ClaudeMemoryKind =
  | "user"
  | "feedback"
  | "reference"
  | "project"
  | "index";

export type ClaudeMemoryFile = {
  readonly filename: string;
  readonly sourcePath: string;
  readonly kind: ClaudeMemoryKind;
  readonly hash: string;
  readonly bytes: number;
  readonly name: string;
  readonly description: string;
  readonly modified: string;
  readonly body: string;
};
