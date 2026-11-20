# Take delegated work to a verified merge

## Problem

`shadowclone-work` stopped at a pull request that was ready for review. Installed copies stopped even earlier, at a draft. In one long session, the owner corrected the agent more than ten times for the same gaps:

- The agent kept human threads open and gave no reply to a decline, so the conversation-resolution rule blocked the merge.
- The agent stopped and asked for a "yes" on steps that needed no decision.
- No step exercised the change on a running environment, so the owner found defects while dogfooding.
- Pull request descriptions had no evidence that the change worked.
- A plain squash merge of a lower stack pull request left the upper branches on commits that the base no longer had.

## Decision

`shadowclone-work` takes the work to a verified merge:

1. Open the pull request ready for review. Add reviewers only when the user names them or the repository rule says so.
2. Fix or decline each thread. A fix gets a reply with only the SHAs. A decline gets one line with the verified reason. Then resolve the thread, from a human or a bot.
3. For a significant change, a verifier subagent exercises the change on the running environment that the repository's context names. It starts on the agent's low-to-medium-cost tier at its latest version. After a checkable failure, it repeats on the next tier up. The evidence goes into the description.
4. Stop only for a decision that belongs to the user. List each other decision until the user acknowledges it.
5. For a stack, verify one pull request, then split it. The original pull request stays the tip, and its tree must equal the verified tree.
6. Merge only when the user's instructions allow agent merges and the gate holds. The gate needs green required checks, no conflict, and the required approval. It also needs zero open threads, and evidence at a head with the verified tree. Merge a stack only with the stack tool's merge command.

Repository facts, such as a preview label or a merge queue, stay out of the skill. The skill reads them from the repository's context and the repository note that the user's instructions name.

`verify-review-findings` declines a human finding the same way as an AI finding. `verify-and-review` adds a gate for the running-environment check, and lets that evidence into the pull request description.

## Consequences

- Users who do not allow agent merges keep a pull request that is ready to merge. The Actions bot and clones still never merge, because their instructions do not allow it.
- A decline now writes one line on the pull request. A reviewer can reopen a thread that the agent resolved.
- `shadowclone-work` now meets the full quality bar, so its permanent lint exemption is gone.

## Verification

- `bun run lint` checks the three skills against the quality bar, the plain-English checker, and the recorded versions.
- The `work` eval grader now requires a resolved thread after a fix, and one non-SHA reply line plus a resolved thread after a decline. `evals/work/grade/index.test.ts` covers both rules.
- The report grader accepts a merge claim only when the agent ran a merge, saw a merged state, and the prompt allowed it. No case allows agent merges, so a merge still fails the hygiene check.
