import { canonicalPath } from "../paths";
import os from "node:os";
import path from "node:path";
type BlockedPath = {
  readonly path: string;
  readonly kind: "directory" | "file";
};

const credentialDirectories = [
  ".ssh",
  ".aws",
  ".gnupg",
  ".kube",
  ".docker",
  ".config/gh",
  ".config/gcloud",
  ".config/op",
  ".password-store",
  "Library/Keychains",
  "Library/Application Support/Google/Chrome",
  "Library/Application Support/Firefox",
  "Library/Application Support/BraveSoftware",
  ".mozilla",
  ".config/google-chrome",
  ".config/chromium",
  ".shadowclone",
  ".claude",
  ".codex",
  ".cursor",
  ".gemini",
] as const;

const credentialFiles = [
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".git-credentials",
] as const;

export function sensitivePaths(homeDirectory?: string): readonly BlockedPath[] {
  const home = homeDirectory ?? os.homedir();
  return [
    ...credentialDirectories.map((relative) => ({
      path: canonicalPath(path.join(home, relative)),
      kind: "directory" as const,
    })),
    ...credentialFiles.map((relative) => ({
      path: canonicalPath(path.join(home, relative)),
      kind: "file" as const,
    })),
  ];
}
