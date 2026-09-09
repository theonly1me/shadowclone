---
name: scope-confirmed-changes
description: Keep a bug fix or review correction tied to reachable behavior and the requested outcome. Use when addressing defects, reviewer findings, or a request for a minimal focused change.
metadata:
  shadowclone-category: change-control
  shadowclone-section: workflow
  shadowclone-applies-when: fixing a defect or addressing review feedback
---
# Scope Confirmed Changes

## Use when

Use this skill when nearby cleanup, defensive cases, or architectural improvements could easily expand a concrete correction. The scope boundary is the observable failure or requested outcome.

## Process

1. State the defect as reachable input followed by incorrect observable behavior, or state the requested outcome in equally concrete terms.
2. Trace the path that produces it and confirm the current code can reach that path.
3. Sort candidate edits into required, supporting, and unrelated changes.
4. Keep required edits that directly change the outcome.
5. Keep a supporting edit only when the required change cannot remain correct or testable without it.
6. Leave unrelated cleanup, speculative guards, and style changes outside the diff.
7. Add or update the narrow test that expresses the confirmed behavior through its public seam.
8. Read every final hunk and map it back to the stated defect, outcome, or necessary verification.
9. Commit each later review round separately so reviewers retain a stable history.

## Guardrails

- Verify a review finding against the current branch before changing code.
- Reject cases that cannot occur under the validated input and type boundaries.
- Avoid widening public contracts to accommodate an internal implementation shortcut.
- Keep refactors only when they create the seam required to fix or test the behavior.
- Preserve unrelated user edits and existing style.
- Use a separate proposal for improvements that do not affect the confirmed outcome.
- Never rewrite pushed history to make a correction look like the first attempt.

When a proposed fix causes a different observable regression, remove that approach and return to the confirmed failure. Do not accumulate compensating changes around a wrong fix.

## Completion

The change is complete when the original behavior is corrected, its focused verification passes, every diff hunk maps to the requested outcome, unrelated observations are left out, and the commit history preserves each pushed correction round.
