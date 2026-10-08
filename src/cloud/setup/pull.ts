import type { Clone } from "../types";
import type { GithubApi } from "./github";
import { isCloneWorkflowPath, openWorkflowPull, readDefaultTree } from "./workflowPull";

export async function createSetupPull(options: {
  readonly clone: Clone;
  readonly token: string;
  readonly api: GithubApi;
}): Promise<string> {
  const { clone, token, api } = options;
  const current = await readDefaultTree({ clone, token, api });

  if (current.tree.truncated || current.tree.tree.some((entry) => isCloneWorkflowPath(entry.path))) {
    throw new Error(
      "A clone workflow already exists, or the tree is incomplete. Review it " +
        "before replacing the installation.",
    );
  }

  const body = `## What changed

- [x] Configure ${clone.botLogin} for this repository.
- [x] Validate requests before accessing the default-branch environment.

## Why

Owner issues and tagged requests need the reviewed personal engineering skills in cloud runs.

## Verification

1. Review both workflows and the guard helpers.
2. Merge this setup PR when the configuration is correct.
3. Create one small issue as ${clone.owner} and confirm the PR uses the App identity and becomes ready for review when its checks pass.
4. Add shadowclone:paused and confirm active work stops.

The live issue flow still needs qualification.
Each worker has a 20-minute limit and a daily branch limit of ${clone.maximumRuns} runs.

## Data handling

Credentials and the reviewed skills are environment secrets.
Only ${clone.defaultBranch} can access them. Each App token names this repository alone.
The default-branch workflow and code executed with credentials remain trusted.
`;

  return openWorkflowPull({
    clone,
    token,
    api,
    parentSha: current.headSha,
    baseTreeSha: current.treeSha,
    message: "ci: configure personal github clone",
    branchPrefix: "shadowclone/setup",
    body,
  });
}
