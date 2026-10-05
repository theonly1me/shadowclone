---
name: scoped-fix
description: Keep fixes and cleanup within the requested outcome, verify reachable defects, preserve unrelated work, and prove meaningful regressions before handoff.
---

# Scoped fixes

Read `clean-code` first. Follow the user's requested scope, including explicitly requested cleanup.

## Establish the change

State the concrete input and wrong behavior, or the requested outcome. Confirm review findings against the current code. For performance defects, measure the suspected cost before choosing a fix.

Keep edits that directly address the request and supporting changes required for correctness or verification. Leave speculative guards, unrelated refactors, and unreachable cases out. Preserve other worktree edits.

Fix a problem at the boundary that owns it. Do not widen a public contract to accommodate an internal shortcut. If an approach causes a regression, remove that approach and reconsider the cause.

## Verify

Run focused checks and `bun run check`. Report pre-existing failures separately and never claim a check passed without running it.

For a new regression test, temporarily invert the smallest enforcing production change. Display the mutated lines, confirm the intended assertion fails, restore the change, and confirm the same test passes. Setup or compilation failures do not prove the test. Preserve unrelated edits throughout this check.

## Review and Git

Follow the chosen direction after discussing a tradeoff; do not repeatedly propose a rejected alternative. In plan mode, wait for approval before editing.

Commit each round separately with a single-line conventional commit message, push, and open or update the draft pull request without stopping for a diff review. Never force push, amend a pushed commit, or add a co-author trailer.
