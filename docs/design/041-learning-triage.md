# Learning triage

## Problem

Learning found real preferences, but none reached a skill. On one installation, 36 learnings waited in `skills pending`. Most of them repeated the user's own `AGENTS.md` or each other. Four org learnings said the same thing, and two of them named a skill that no longer existed.

The user had to review each learning by hand. `learning reject` printed success for a learning without a registered repository, but it saved nothing. Background publication stopped at `awaiting-publication`, because automatic maintenance was off.

Repository learnings waited for a registered repository. Registration adds the repository's own skill folders, so a user who must not change a work repository had no way to receive them.

## Decision

Learning removes duplicates in two places, and the session-end worker decides the rest.

1. **Coverage.** With `agent-context` consent, learning reads the global instruction files that the baseline snapshot already reads (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.codex/AGENTS.override.md`). With `skill-library` consent, it reads full user-owned skill text in the applicable scope. The text passes through the redaction snapshot and has a byte limit.
2. **Reconciliation.** The reconciliation prompt shows the coverage as guidance that the user already maintains. A new rule that names a coverage token is dropped, as a rule that names a rejection token is dropped.
3. **Triage.** After distillation, the worker groups pending learnings by scope and sends each group with its applicable coverage, inside the shared learning budget. Each learning gets `apply`, `discard` with a reason (`duplicate`, `skill-covered`, `one-off`, or `stale`), or `defer`.
4. **Discard** uses the retire lifecycle. The record becomes a rejection, so the same rule does not return, and reconciliation sees it later. `learning reject` uses the same path for a learning that has no registered scope.
5. **Apply** uses `publishReviewedLearning`, which keeps ownership checks and records a revision. Triage applies only when automatic maintenance is on (`shadowclone skills automatic on`). While it is off, triage only discards and defers.
6. **Notice.** The next session start shows one line with the counts and `shadowclone history`. The line appears once.
7. **Repository delivery.** Each registered repository has a delivery choice. `repository` keeps today's behavior. `private` writes skills to `~/.shadowclone/builds/learning-<id>/skills` and changes no repository file. The session-start hook delivers private rules and skill paths only inside that repository. `learning repositories set <directory> --private|--repository` saves the choice and registers the repository.
8. **One-time question.** If the current repository has pending repository learnings and no choice, session-start context asks the agent to ask the user once and run the command.

Triage never merges learnings across isolated origins. Unknown origins stay isolated. A repository learning is discarded only when global coverage or a learning in the same scope covers it.

## Consequences

- Triage adds one model call to a worker run that has pending learnings. It uses the existing call, time, and cost limits.
- A wrong `apply` can publish a weak rule. Revisions, the notice, and `shadowclone undo` reverse it.
- A wrong `discard` hides a rule. `learning history` and `undo` restore it.
- The `agent-context` source gets a second purpose. `docs/data-handling.md` names it.
- Existing registrations have no delivery field and keep the `repository` behavior.

## Verification

- A worker test discards a learning that the instruction file states and applies a new one, with one revision each.
- A CLI test shows that `learning reject` removes an unscoped learning from `skills pending`.
- A hook test shows the notice once and the repository question only when no choice exists.
- A test shows that a private repository writes skills under `~/.shadowclone` and no file in the repository.
- Learning tests use mock runners and synthetic fixtures. They make no model call.

## Scoped catalogs and complete coverage

Startup has no task text. It keeps universal rules and selected workflow requirements automatic. It points to a catalog for task-specific learned skills. Before task work, each agent reads the catalog and loads every matching skill.

Each learning scope owns one catalog beside its skills. Catalogs use the existing artifact and reversible revision system. Publication preserves manual edits. Isolated agent delivery writes a catalog with paths inside its snapshot. Older installations create a missing catalog with `shadowclone sync`.

Coverage includes the full redacted text of user-owned skills. Repository instruction files and repository skills cover only rules for that verified repository. Global rules use only global coverage. Source consent, Git identity checks, redaction, and byte limits still apply. An excessive coverage input stops learning before it proposes rules.

Reconciliation receives only coverage for its evidence scope. Triage groups pending rules by scope, within the existing learning budget. A duplicate must preserve the same conditions and requirement. A correction that changes a requirement stays eligible. Deferred triage decisions include the maintained guidance fingerprint, so guidance changes trigger another check.

Implement catalog publication and routing first. Add scoped coverage and deferred-decision invalidation next. Verify both through synthetic files, mock model runners, native startup, and isolated delivery.
