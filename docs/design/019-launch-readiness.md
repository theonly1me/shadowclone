# Launch readiness

## Summary

Shadowclone learns a developer's engineering taste from named local sources, delivers one profile to the main agent and spawned clones, and lets later clone sessions improve that shared profile. This change gives Claude subagents live guidance, reduces evaluation setup and judgment time, runs independent reconciliation batches concurrently, and makes default onboarding three grouped questions. The profile remains editable Markdown, and consent, redaction, and local ownership remain explicit.

## Problem

Claude subagents previously relied on an optional static repository agent file. A spawned subagent could miss newer profile changes, and a second session-start path could create another learning request. Transfer evaluation rebuilt the same repository tree for each arm and ran independent work sequentially. Distillation also serialized independent batches. The old setup asked many source and installation questions and told users to run `learn` afterward.

Generic instruction cleanup can change the meaning of an explicit preference. Multiple agents need consistent scoped guidance, while later user corrections need a deliberate learning path that preserves source consent.

## Prerequisites

Claude Code 2.1.236 delivered `SubagentStart` hook context to a spawned subagent in a local check. The hook payload includes `hook_event_name`, so the integration can return the matching event name.

Existing source flags default off, and `detectOnboardingPresence` reduces each configured root to a temporary present or absent value before consent.

`createLearningExecution` applies its deadline to the model-call sequence. Completed reconciliation checkpoints are read before a model call, so retrying finished work costs no model allowance.

## Design

Claude Code installs a `SubagentStart` hook alongside `SessionStart` and `SessionEnd`. The start handler returns the event name from its payload, falling back to `SessionStart`. A subagent receives only the compiled profile. It cannot create a session-learning request. Codex, Cursor, and Antigravity hook sets remain unchanged.

Transfer evaluation builds one validated snapshot template for each repository and commit, then clones it for isolated arms. Each clone includes `.git` and is cleaned independently. Copy-on-write is attempted first on macOS or Linux, with a normal copy as fallback. The evaluator disposes templates at the end of a run. Independent arms execute concurrently. [Record 020](020-preference-judging.md) supersedes the original paired judging with three-arm, candidate-independent batches and per-batch recovery.

Distillation runs up to eight independent reconciliation batches at once. It collects their outputs in input order and applies reconciliation sequentially. Rule consolidation remains one call per origin after reconciliation. The shared learning execution enforces the same total call count and deadline.

Default `shadowclone init` prints detected agent names and configured source paths before three yes-default questions. The first enables only detected session sources plus Git metadata and agent context; the second enables skill-library consent; the third enables deep and automatic learning. It then imports detected repository guidance, syncs skills, runs one recent-first learning wave with a 12-call and 90-second model-call limit, and installs detected agents globally. A model budget stops the first pass without failing setup. Transcript ingestion is not covered by that deadline. `init --advanced` keeps individual source and wizard choices. The `install` command keeps its explicit scope options.

The user can read, edit, or delete the resulting Markdown profile. `shadowclone forget --all` removes stored state and recorded integrations. Agent transcripts remain under their original providers. Each clone's session adds another consented transcript that can update the shared profile.

## Files

| Path | Change |
| --- | --- |
| `src/integrations/`, `.claude-plugin/hooks/hooks.json` | Deliver Claude `SubagentStart` context and preserve hook ownership on install and uninstall |
| `src/eval/transfer/` | Cache validated snapshot templates and run isolated arms and votes concurrently |
| `src/distill/` | Bound concurrent reconciliation and preserve ordered application |
| `src/engine/learning.ts`, `src/learning/state.ts` | Add first-pass limits and recent-first unprocessed selection |
| `src/cli/init*.ts`, `src/cli/index.ts` | Provide the default three-question setup and retain advanced choices |
| `README.md`, `docs/architecture/`, `docs/skill-maintenance.md` | Document consent, privacy, clone inheritance, and setup |

## Data handling

Default setup shows paths and source names before grouped consent. Every flag stays off in the default configuration; absent session roots stay off after a yes answer. Git remote discovery and agent context have separate flags from transcripts, even though one grouped answer may enable them. Managed policy remains a ceiling.

Events and signals hold pointers. `resolveRedacted` is the only exported materialization path for captured text, and it calls `redactSecrets` before model egress. The first learning pass uses the existing ingest, allowlist, and reconciliation path. Tool results, file-read contents, thinking blocks, and data-access results remain excluded. No new network call or endpoint is added. Model calls go through the user's authenticated agent CLI. The disposable index, processed ledger, Markdown profile, skill state, eval suites, and receipts remain local. Eval templates and clones contain consented redacted agent context and are removed at run end.

## Alternatives

**A `PreToolUse` hook for subagents.** Rejected because the verified `SubagentStart` hook already delivers context directly.

**Rebuild every eval arm.** Rejected because the repository copy was a large measured share of run time and a validated template can be cloned without sharing writable state.

**Apply distillation as each batch finishes.** Rejected because ordered aggregation preserves rule output and checkpoints already make retries cheap.

**Keep the wizard as the default setup.** Rejected because detected paths and three grouped choices cover the common case while `--advanced` retains individual choices.

## Accepted costs

A cached eval template uses disk space until its evaluation ends. Copy-on-write may be unavailable, so the fallback still copies the tree. Concurrent arms and votes increase peak process use. A 90-second model allowance may apply no rules if it expires; background learning can continue later from checkpoints. Grouped consent may enable several detected sources at once, so the path summary must stay clear and visible.

## Testing

Focused tests cover Claude hook payloads, subagent learning-request isolation, install and uninstall ownership, snapshot isolation and symlink rejection, independent eval arms and resumable failure, judge majority, concurrent batch order and rejection, three default prompts, absent sources staying off, advanced setup, and first-pass completion. Each new regression test must fail under a targeted mutation and pass after restoration. Run `bun run check` for typecheck, lint, and tests. Subsequent exploratory evaluation results and their limits are recorded in [evals.md](../../evals.md); they do not establish full provider or plugin-installation qualification.

## Open questions

The first-pass deadline does not cancel transcript ingestion. A strict two-minute setup promise needs cancellation through capture or an isolated worker.

Concurrent reconciliation calls can each see the same remaining cost before results are charged, and identical prompts can race on one checkpoint path. The current call ceiling still holds. The shared cost allowance and checkpoint writes need serialization before a strict cost guarantee is claimed.

## Decision record

Claude `SubagentStart` receives live scoped guidance because spawned clones must inherit the current profile.

Eval templates, arm execution, judge votes, and reconciliation batches are parallelized only where their results have independent state.

Default setup groups named consent into three questions, and advanced setup retains individual control.

The first learning pass starts with recent unprocessed steering and has a shared model-call deadline. Transcript indexing remains outside that limit.
