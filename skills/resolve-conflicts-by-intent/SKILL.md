---
name: resolve-conflicts-by-intent
description: Resolve an in-progress merge or rebase by tracing each conflicting change to its original intent and validating the combined behavior. Use when Git reports conflicted files.
metadata:
  shadowclone-category: version-control
  shadowclone-section: workflow
  shadowclone-applies-when: resolving an in-progress merge or rebase conflict
---
# Resolve Conflicts by Intent

## Use when

Use this skill only while a merge or rebase is in progress. A conflict is a disagreement between changes, so the correct result comes from understanding both changes rather than choosing the side with newer text.

## Process

1. Inspect the Git operation, conflicting paths, current branch, and commits being combined.
2. Read each conflicted file with enough surrounding code to understand the affected behavior.
3. Find the primary source for both sides: commits, pull requests, issues, design records, tests, and nearby callers.
4. State the intent of each side before editing the hunk.
5. Decide whether both intents can coexist. When they cannot, choose the intent that matches the merge goal and record the lost behavior for review.
6. Resolve one hunk at a time in the current architecture. Avoid introducing a third design that neither side requested.
7. Search the full file for related names and assumptions that Git did not mark as conflicts.
8. Run focused checks after each coherent file group, then the repository's merge gate.
9. Stage resolved files and continue the Git operation until no conflicts remain.
10. Inspect the combined diff against both original intents before reporting completion.

## Guardrails

- Use whole-file ours or theirs only when one side's entire file is intentionally obsolete.
- Preserve schema changes, migrations, generated artifacts, and tests as one coherent set.
- Treat rename and delete conflicts as behavior decisions rather than path cleanup.
- Keep conflict markers out of the staged tree.
- Separate failures introduced by the merge from failures already present on either parent.
- Finish the requested merge or rebase after resolution unless a destructive or irreversible choice needs user input.

When intent remains ambiguous after reading primary sources, present the exact incompatible outcomes and the evidence for each. Ask about that decision instead of guessing from line order.

## Completion

Resolution is complete when Git reports no unmerged paths, each hunk has a stated intent-based result, the combined behavior passes relevant checks, the operation has finished, and the final diff preserves every compatible requirement from both sides.
