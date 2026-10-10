import os from "node:os";
import path from "node:path";
import { readGit } from "../collect/git";

export const toolchainBudgetMilliseconds = 10 * 60_000;

export async function sharedCargoTarget(repository: string): Promise<string> {
  const rootCommits = await readGit({
    checkout: repository,
    arguments: ["rev-list", "--max-parents=0", "HEAD"],
  }).catch(() => "");
  const identity = rootCommits.trim() === "" ? repository : rootCommits.trim();
  const key = new Bun.CryptoHasher("sha256").update(identity).digest("hex").slice(0, 16);

  return path.join(os.tmpdir(), "shadowclone-cargo", key);
}
