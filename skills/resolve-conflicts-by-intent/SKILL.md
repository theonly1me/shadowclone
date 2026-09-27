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

A merge or rebase is in progress and Git reports conflicts.

## Process

1. Inspect the operation, conflicting paths, and commits being combined.
2. Read surrounding code and the commits, design records, tests, or review discussions explaining each side.
3. Identify both intended behaviors. Preserve compatible requirements; ask about incompatible outcomes when the merge goal does not settle them.
4. Resolve each hunk in the current architecture. Check related names and assumptions outside Git's conflict markers.
5. Run focused checks and the repository's merge gate. Separate new failures from failures present on either parent.
6. Stage resolutions and finish the authorized operation. Review the combined diff against both original intents.

## Guardrails

Use whole-file ours or theirs only when that entire side is intentionally obsolete. Keep schema changes, migrations, generated artifacts, and tests coherent. Rename and delete conflicts can change behavior.

Avoid introducing an unrelated third design. Remove all conflict markers and preserve unrelated user edits. Follow the repository's approval requirements for Git operations.

## Completion

No unmerged paths remain, compatible requirements survive, checks cover the combined behavior, and the authorized operation is finished.
