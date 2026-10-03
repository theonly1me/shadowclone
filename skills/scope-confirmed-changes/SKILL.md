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

Fixing a defect or review finding, or making a change whose scope should stay narrow.

## Process

1. State the reachable input and incorrect behavior, or the requested outcome.
2. Trace the current path and verify the finding against the working branch.
3. Keep edits that correct the outcome, plus supporting changes required for correctness or verification.
4. Leave unrelated cleanup and speculative guards outside the diff.
5. Verify the behavior through a stable public interface and map each final hunk back to the request.

## Guardrails

Preserve unrelated user edits and existing style. Do not widen a public contract to accommodate an internal shortcut. Refactor only when the requested fix or its verification needs it.

If an approach causes another regression, remove that approach and reconsider the cause. Avoid layering compensating changes onto a wrong fix. Keep later review rounds in separate commits when authorized; never rewrite pushed history.

## Completion

The requested outcome works, focused verification passes, and every hunk has a reason within scope.

Report the outcome in one sentence, the verification command with its result, and each changed file with the reason it is in scope. Keep the reply to these facts. When a pull request exists, put full command output in its verification section instead of the reply.
