# Self-improving portable agent environment

## Summary

Shadowclone delivers the current engineering profile to the user's main coding agent, maintains a portable personal skill library across supported agents, learns only from sessions explicitly identified as useful, and evaluates the effect of that profile on fresh work from the current repository HEAD. The optional Shadowclone subagent and headless dispatch remain available, but they are no longer the primary delivery path.

## Problem

Installing only a custom subagent requires the user to remember to select it, duplicates context already available to the main agent, and leaves ordinary Claude Code, Codex, Cursor, and Antigravity sessions unchanged. Static provider instruction files and copied skills become stale after learning. Treating every interrupted tool call as negative feedback creates false preference evidence because users also interrupt to add context or ask a question. The historical-task evaluator excludes useful repositories, depends on obsolete lockfiles and profile timestamps, and often returns `insufficient-evidence` or `uncertain`, which cannot answer whether the profile improved agent behavior.

## Prerequisites

Native delivery requires a supported provider hook capable of adding session context to the main agent.

Learning requires explicit source consent, deep-distillation consent, and the user's authenticated agent CLI.

Evaluation requires a Git repository whose current committed HEAD can be isolated into a disposable snapshot.

## Design

`shadowclone install` defaults to global main-agent delivery. It supports Claude Code, Codex, Cursor, Antigravity, or all supported agents. Native instruction files receive a stable managed pointer. Session hooks compile and inject the current global, organization, and repository profile at session start, so profile updates do not repeatedly rewrite provider instruction files. Repository scope remains available through `--repo`. The Claude subagent and delegation skill remain explicit options for headless or independent work.

The native hook creates an opaque, expiring token for a session only when deep and automatic learning consent are enabled. The hook tells the agent to run `shadowclone learn --session <token>` near the end only when the session contains a reusable engineering preference or a clear correction. Shadowclone stores the opaque token and a hash of the provider session identifier, marks the session complete at its native end event, and schedules learning only when both the explicit request and session end are present. A missed end event is recovered at the next native start. Stops alone never create evidence. Signal extraction groups the next user message with the interrupted action so added context, cancellation, questions, and actual corrections remain distinguishable.

Explicit reusable preferences and corrections can activate after one independent session. Inferred patterns still require support from three independent sessions. Deep learning updates the profile and then runs enabled skill maintenance within the same bounded execution allowance. Direct preferences recorded with `shadowclone remember` remain declared guidance and need no inference.

Onboarding installs selected starter skills as complete directories in `~/.agents/skills`, including their supporting files. Shadowclone records that directory as the canonical personal copy and synchronizes replicas for Claude Code, Codex, Cursor, and Antigravity-compatible skill locations. One changed copy becomes the source for the next synchronization. Different edits in multiple copies create a conflict and no copy is overwritten. A later wizard run removes an unedited starter that is no longer selected. An edited starter becomes adopted user content and is preserved. Existing user-owned skills stay user-owned unless explicitly managed.

`shadowclone eval` starts every task from the repository's current committed HEAD and ignores uncommitted files with a visible count. The evaluator accepts one supplied implementation task, generates a bounded set of fresh tasks, or loads a frozen suite. Generated tasks add a self-contained module or function and focused tests through new files in an existing package. Preflight proves that HEAD can be isolated. No phase copies dependencies, installs packages, runs lifecycle scripts, or executes repository-wide verification. Generated and supplied tasks cannot require commits, pushes, deployments, migrations, external services, credentials, network access, new dependencies, or writes outside the isolated snapshot.

Every task runs baseline and clone arms against identical snapshots, model settings, and requirements. Native Shadowclone discovery is removed from both arms. The baseline keeps repository-native guidance; only the clone receives the frozen personal instructions, relevant skills, memory, and current profile. Each run persists observed code evidence before judging so a failed judge can resume without repeating coding work. Three blind paired code-review votes produce a binary result for every correctness and preference requirement, with candidate order swapped for the middle vote. Deterministic checks cover reviewability and Git integrity. Missing, malformed after two retries, incomplete, or truncated evidence fails or produces an infrastructure error; it never creates an unknown outcome.

Elapsed progress identifies preparation, task, repetition, arm, execution stage, and judge vote. The current stage is also persisted in the private receipt, so long-running work can be inspected from another process.

The final evaluation status is `PASS`, `FAIL`, or infrastructure `ERROR`. Reports include baseline and clone task success, baseline and clone preference adherence, percentage-point lift, relative improvement when defined, paired wins, ties, losses, correctness regressions, safety regressions, and sample size. Passing requires positive preference-adherence lift, nonzero clone task success, no worse task success, no correctness regression, no safety regression, and every expected pair. A one-task, one-repeat run is labeled as a smoke test and is not decision-grade. Suites can be reused across engines through `--suite-id`; interrupted executions resume through `--eval-id` only when all frozen inputs still match.

## Files

| Path | Change |
| --- | --- |
| `src/integrations/` | Install stable native pointers, inject live scoped context, and create session-learning tokens for four providers |
| `src/learning/` | Persist opaque session requests and run bounded learning only for explicitly selected sessions |
| `src/signal/` | Interpret interruptions with the following user message |
| `src/distill/` | Activate explicit reusable guidance after one session while retaining the three-session threshold for inference |
| `src/skills/` | Install complete starter skills into the portable personal library |
| `src/skillMaintenance/` | Synchronize provider replicas, preserve edits, surface conflicts, and retire only unchanged starters |
| `src/eval/transfer/` | Replace historical replay selection with fresh current-HEAD suites and binary quantified grading |
| `src/cli/` | Expose native defaults, session learning, portable skill setup, and the new evaluation options |
| `README.md` | Document the self-improving environment, native delivery, portable skills, and current evaluator |

## Data handling

Native start hooks read only the current scoped profile through `compileProfile`. Session-learning state stores an opaque random token, an integration identifier, a hash of the provider session identifier, and timestamps under `~/.shadowclone`; it does not store the raw provider identifier or transcript text. Transcript excerpts still enter model-facing learning only through `resolveRedacted`, and only enabled sources are read. Skill assessment reads only configured, consented roots and resolves skill text through `resolveRedacted`; portable synchronization is local and makes no model call. Evaluation reads the current committed repository, optionally reads consented agent context through `resolveRedacted`, and sends task, profile, changed-file, diff, action, and judge evidence through the existing engine and redaction boundaries. Suites and private receipts stay under `~/.shadowclone`. No telemetry or new hosted service is added.

## Alternatives

**Keep the custom subagent as the product.** Rejected because it leaves the default agent unchanged and makes users manage an extra invocation choice in every session.

**Write the full compiled profile into every provider instruction file.** Rejected because each learning update creates noisy provider-specific rewrites and stale copies. A stable pointer plus live hook keeps one source of truth.

**Update arbitrary provider skills automatically.** Rejected because provider copies can diverge and many skills contain technical workflows that preference evidence cannot safely rewrite. Canonical synchronization, explicit adoption, and conflict preservation keep user ownership visible.

**Learn at every session end or every interruption.** Rejected because session length and stopped tools do not prove reusable guidance. The session agent has enough context to request learning deliberately, and later user messages disambiguate interruptions.

**Retain historical tasks as the only evaluator input.** Rejected because it couples evaluation to transcript timing, old repository states, and old dependency trees. Fresh bounded work on current HEAD measures whether the current profile helps now.

**Allow uncertain judge outcomes.** Rejected because an evaluation that cannot classify its evidence does not support a product decision. Independent binary votes, strict evidence requirements, and an explicit infrastructure error separate product failure from evaluator failure.

## Accepted costs

Native behavior depends on provider hook support and can require provider-specific maintenance.

Portable skill replication uses more local disk space and surfaces conflicts that the user may need to resolve.

Fresh generated tasks test current usefulness but do not recreate a historical user's intended implementation.

Three judge votes and two execution arms increase authenticated agent usage. The CLI displays the maximum invocation count before starting.

Binary missing-evidence failure is intentionally strict and can lower measured scores when an agent completed work but left inadequate observable proof.

## Testing

Unit tests cover native target paths, stable pointers, hook payloads, opaque session state, explicit request gating, stop-followup episodes, activation thresholds, full-directory skill replication, missing-copy repair, divergent-copy conflicts, edited-starter preservation, current-HEAD snapshots, additive-task constraints, unsafe-task rejection, clone-only context, dependency-free preflight, immutable Git metadata, paired candidate-order reversal, three-vote judging, binary reports, progress persistence, suite validation, and evidence-preserving resume.

The repository gate runs type checking, lint, all tests, and the production build. Regression tests are mutation-proven by temporarily removing the behavior they protect, printing the mutated line, observing the focused test fail, restoring the implementation, and observing the same test pass.

An authenticated smoke evaluation runs one task once from a real repository. A decision-grade evaluation runs three tasks twice with one engine, then can reuse the frozen suite with a second engine. The README can publish only aggregate outcomes and sample size, without engine, model, repository, task, prompt, diff, or private receipt contents.

## Open questions

None.

## Decision record

Main-agent native delivery is the default because ordinary coding sessions must receive the profile without a user selecting a subagent.

Native instruction files keep a stable pointer because session hooks can inject the latest scoped profile without repeated file churn.

Useful-session learning requires an explicit in-session request because a stop or session boundary is not preference evidence.

Explicit reusable guidance activates after one session because it records a stated preference; inferred guidance retains the three-session threshold because it extrapolates behavior.

Selected starter skills become a portable synchronized personal library because useful workflows should follow the user across agent products.

Fresh current-HEAD tasks replace historical-only selection because evaluation must work on any suitable repository without depending on its installed dependency tree.

Evaluation outcomes are binary and quantified because pass, fail, lift, and regression counts support product decisions while unknown classifications do not.
