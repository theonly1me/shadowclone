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

The original two-arm design was extended to bare, skills, and clone arms. All receive the same repository snapshot and task. Skills and clone receive the same frozen personal instructions, skills, and memory; only clone adds the compiled profile. Native Shadowclone discovery is disabled in each arm. [Design 020](020-preference-judging.md) defines the current frozen rubric, independent candidate grading, immediate vote checkpoints, and recovery behavior.

Elapsed progress identifies preparation, task, repetition, arm, execution stage, and judge vote. The current stage is also persisted in the private receipt, so long-running work can be inspected from another process.

Completion is separate from measured improvement. Reports show correctness and preference adherence per arm, profile and library lift, paired outcomes, regressions, and sample size. Missing grades are ungraded. A complete tie or loss is valid. The CLI labels at least three tasks with two repeats as decision-grade, but that threshold is not statistical validation. Frozen suites support comparison across engines; evaluation resume validates the saved inputs and retries missing work.

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

Native start hooks read the scoped profile through `compileProfile`. Session-learning state stores opaque tokens, hashed provider session identifiers, and timestamps, not transcript text. Learning and skill assessment resolve consented text through `resolveRedacted`; portable synchronization is local. Evaluation separately authorizes the coding provider to read the repository snapshot and sends unredacted generated code to judges. Suites and receipts remain local under `~/.shadowclone`. No telemetry or hosted service is added.

## Alternatives

**Keep the custom subagent as the product.** Rejected because it leaves the default agent unchanged and makes users manage an extra invocation choice in every session.

**Write the full compiled profile into every provider instruction file.** Rejected because each learning update creates noisy provider-specific rewrites and stale copies. A stable pointer plus live hook keeps one source of truth.

**Update arbitrary provider skills automatically.** Rejected because provider copies can diverge and many skills contain technical workflows that preference evidence cannot safely rewrite. Canonical synchronization, explicit adoption, and conflict preservation keep user ownership visible.

**Learn at every session end or every interruption.** Rejected because session length and stopped tools do not prove reusable guidance. The session agent has enough context to request learning deliberately, and later user messages disambiguate interruptions.

**Retain historical tasks as the only evaluator input.** Rejected because it couples evaluation to transcript timing, old repository states, and old dependency trees. Fresh bounded work on current HEAD measures whether the current profile helps now.

**Treat missing judgments as failed criteria.** Rejected because an evaluator failure is not evidence of poor code. Valid verdicts are binary; missing work stays ungraded and can be resumed.

## Accepted costs

Native behavior depends on provider hook support and can require provider-specific maintenance.

Portable skill replication uses more local disk space and surfaces conflicts that the user may need to resolve.

Fresh generated tasks test current usefulness but do not recreate a historical user's intended implementation.

Three votes per criterion across three execution arms increase authenticated agent usage. The CLI displays the maximum invocation count before starting.

Evidence must be complete enough to review. Missing code or judge responses produce incomplete results, not invented grades.

## Testing

Unit tests cover native delivery, useful-session consent, activation thresholds, skill synchronization and conflicts, snapshot isolation, safe task constraints, arm-specific context, three-vote judging, saved progress, suite validation, and evidence-preserving resume. Judging regression fixtures are documented in design 020.

The repository gate runs type checking, lint, and tests; the production build is a separate release check. Regression tests are mutation-proven by temporarily removing the behavior they protect, printing the changed line, observing the focused test fail, restoring the implementation, and observing the same test pass.

Live validation begins with one bounded task before a larger suite. Public summaries should state the model settings, arm setup, abstract tasks, scores, and relevant limitations. [The evaluation report](../../evals.md) records four exploratory tasks with one implementation per arm and task.

## Open questions

None.

## Decision record

Main-agent native delivery is the default because ordinary coding sessions must receive the profile without a user selecting a subagent.

Native instruction files keep a stable pointer because session hooks can inject the latest scoped profile without repeated file churn.

Useful-session learning requires an explicit in-session request because a stop or session boundary is not preference evidence.

Explicit reusable guidance activates after one session because it records a stated preference; inferred guidance retains the three-session threshold because it extrapolates behavior.

Selected starter skills become a portable synchronized personal library because useful workflows should follow the user across agent products.

Fresh current-HEAD tasks replace historical-only selection because evaluation must work on any suitable repository without depending on its installed dependency tree.

Validated criterion votes are binary, while evaluation completion and measured improvement are reported independently.
