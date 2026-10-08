import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess } from "../io/process";
import type { ReviewModel } from "./analyze";
import { readPullFacts } from "./collect";
import { analyzeStage, checksStage, prepareStage } from "./stages";
import type { PullFacts, ReviewResult } from "./types";
import { addWorktree, removeWorktree } from "./worktree";

async function fetchPullRefs(options: { readonly checkout: string; readonly facts: PullFacts }): Promise<void> {
  const fetched = await runProcess({
    arguments: ["git", "fetch", "--no-tags", "origin", `refs/pull/${options.facts.number}/head`, `refs/heads/${options.facts.baseRefName}`],
    cwd: options.checkout,
    environment: process.env,
    timeoutMilliseconds: 300_000,
  });

  if (fetched.exitCode !== 0) {
    throw new Error(`git could not fetch pull request ${options.facts.number}: ${fetched.stderr.trim().slice(0, 300)}`);
  }
}

export async function reviewLocally(options: {
  readonly repository: string;
  readonly number: number;
  readonly checkout: string;
  readonly reviewModel: ReviewModel;
  readonly runChecks: boolean;
  readonly onProgress: (message: string) => void;
}): Promise<ReviewResult> {
  const { checkout, onProgress } = options;
  const facts = await readPullFacts({ repository: options.repository, number: options.number, cwd: checkout });

  onProgress(`Fetching pull request ${facts.number}`);
  await fetchPullRefs({ checkout, facts });

  const workDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-review-"));
  const headDirectory = path.join(workDirectory, "head");

  try {
    const head = await addWorktree({ repository: checkout, sha: facts.headSha, directory: headDirectory });
    const packet = await prepareStage({
      repository: options.repository,
      number: options.number,
      checkout: head.root,
      cwd: checkout,
      network: options.reviewModel.network,
      head: facts.headSha,
    });

    onProgress(`Built-in rules matched ${packet.ruleHits.length} added lines`);

    const checks = options.runChecks ? await checksStage({ packet, repository: checkout, workDirectory, onProgress }) : null;

    onProgress(`Reviewing with ${options.reviewModel.model}`);

    return await analyzeStage({ packet, checks, checkout: head.root, reviewModel: options.reviewModel });
  } finally {
    await removeWorktree({ repository: checkout, directory: headDirectory });
    await rm(workDirectory, { recursive: true, force: true });
  }
}
