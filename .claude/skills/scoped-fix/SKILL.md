---
name: scoped-fix
description: Discipline for making a code change (fixing a bug, addressing findings from an automated reviewer or PR comments, or any follow-up edit to existing code). Use whenever the user says "fix this", "address the review", "clean up", "only what's necessary", "be pragmatic", or hands you a batch of findings to act on. Keeps the diff minimal and scoped to confirmed reachable bugs, verifies it is regression-free before presenting, avoids change-then-regress-then-revert churn, and commits each round separately without ever force pushing or amending a pushed commit.
---

# Scoped fix

Load the clean-code skill first for the conventions this relies on. This skill adds the discipline for changing existing code.

Make the change without scope creep or thrash. This prevents a specific failure mode: bolting marginal nits onto a real fix, editing code that guards inputs that cannot occur, touching unrelated subsystems, and the change-then-regress-then-revert loop that destroys trust.

**The rule: ship the ONE confirmed, reachable bug. Everything else is a separate, opt-in decision, not yours to bundle.**

## Before writing code

- **Name the bug in one sentence:** concrete inputs, then the wrong behavior they produce. If you cannot state it, you do not understand it yet. Investigate or ask. Do not start editing.
- **Confirm it is reachable in this domain.** A fix guarding an input that cannot occur here is not worth making. If it does not fail today, you do not need the change.
- **Perf fixes:** quantify the suspect's cost against the symptom's magnitude before building anything.

## Triage every candidate change

Ask of each one: does this fix an observable failure?

- Yes: in scope.
- Defensive, hygiene, style, a can't-happen input, or an unrelated subsystem: out of scope. Note it as an optional separate follow-up. Never bundle it. No "while I'm here."

## Make the change

- Minimal diff. Every hunk should map to a symptom. One concern per change.
- Do not fix a composed-system concern by editing a unit's documented contract. Fix it where it belongs, or leave it.
- When you deliberately escape a check that flags false positives, do not reintroduce the same check elsewhere as a safety net. Commit to the decision.

## Verify before presenting

- Trace or run the affected tests. A fix must never flip a green test red. If it does, the fix is wrong. Rethink it, do not ship it.
- Run `bun run typecheck` and `bun test` on the touched files yourself.
- Hand off heavy or fan-out checks to the user. State what you verified and what is still pending. Never claim "done" or "green" for a check you did not run.

### Prove the regression test catches the bug

A new test that passes proves nothing on its own. It passes against the fix, and it would also
pass against a fix that does nothing, against the wrong assertion, and against a test that
never reaches the code. The only evidence that it guards the bug is watching it fail without
the fix.

So revert and re-run. Make the revert the minimal inverse, usually flipping the one condition
or restoring the one line, not deleting the whole change, so the test fails for the reason you
claim rather than on a compile error. Confirm it fails, restore, confirm it passes again.

**Print the reverted lines before running the test.** This is the step that makes the rest
worth anything. An edit that silently fails to apply, a string replacement that did not match,
a path that pointed at the wrong file, leaves the code unchanged, and the test then passes
because the fix is still there. That outcome is indistinguishable from a test that does not
catch the bug, and it reads as success. Show the mutated lines with their numbers, verify the
inverse is really in the file, and only then trust the run.

## Commit and push

Never force push, and never amend a commit that is already on the remote. A reviewer who has read
the branch loses their place, inline review comments detach from the diff they were written
against, and anything that exists only on the remote is gone.

Every round of changes is its own commit, with a one-line message saying what that round does.
Fixing a lint error, taking a review finding, and reworking an approach are three commits, not one
commit rewritten three times. Match the repo's subject-line convention, which `git log --oneline`
shows. Never add a co-author trailer.

This holds even when amending looks tidier, and it holds for a draft PR, because a reviewer or a
bot may already have read it.

## When challenged, or when something regresses

- If a change proves marginal, or a fix causes a regression, revert it. Do not defend it. A reverted marginal change beats a defended one.
- Scope edits to what was asked. Surface a necessary side-change for permission rather than silently substituting your own choice.
- Critique a direction once. Once the user chooses, build their choice. Do not re-propose the rejected alternative.

## In plan mode

Write the plan and get approval before editing code, even for small obvious fixes.
