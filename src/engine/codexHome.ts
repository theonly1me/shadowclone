import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const carriedEntries = ["auth.json"] as const;

export function userCodexHome(options: {
  readonly environment?: NodeJS.ProcessEnv;
  readonly userHome?: string;
} = {}): string {
  const environment = options.environment ?? process.env;
  return environment.CODEX_HOME ??
    path.join(options.userHome ?? os.homedir(), ".codex");
}

export async function isolatedCodexHome(options: {
  readonly temporaryDirectory: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly userHome?: string;
}): Promise<string> {
  const source = userCodexHome(options);
  const target = path.join(options.temporaryDirectory, "codex-home");
  await mkdir(target, { recursive: true });
  for (const entry of carriedEntries) {
    const file = Bun.file(path.join(source, entry));
    if (await file.exists()) {
      await Bun.write(path.join(target, entry), file);
    }
  }
  return target;
}
