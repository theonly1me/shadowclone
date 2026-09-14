# Automatic Preference Learning

[Design 017](017-self-improving-agent-environment.md) adds an explicit useful-session request, and [design 018](018-incremental-learning-repair.md) replaces the rolling lookback window with a durable processed ledger.

## Summary

Shadowclone learns from user steering episodes and applies supported profile changes automatically after explicit setup consent. Stop events remain descriptive statistics and never independently support a preference. Local history and undo make each profile change inspectable and recoverable.

## Problem

The signal miner labels interruptions as corrections without examining the follow-up. Deep learning requires a manual command, and native session-end hooks only refresh existing guidance. Repeated ingestion can spend model calls on previously examined evidence. There is no user-facing history or direct preference-recording interface.

## Prerequisites

Record 014 supplies native lifecycle hooks and managed destinations.

## Design

Structural reporting remains model-free. A separate learning stream groups consecutive user prompts, including prompts separated by interruptions, with the preceding assistant explanation as context. Bare interruptions and permission refusals have no preference evidence. Reconciliation classifies each episode as a preference, correction, approval, additional context, cancellation, or unknown, and marks whether it expresses durable guidance. Only durable preferences, corrections, and approvals can change profile evidence. Assistant context does not independently support a rule. Generated Shadowclone input is excluded. The learner version changes so old checkpoints cannot reuse the previous interpretation.

Automatic learning is a distinct opt-in setting under distillation and requires existing deep-learning consent. Native hooks enqueue a detached bounded worker without waiting for inference. The worker catches up on consented sources, selects up to 60 unprocessed episodes from the last 30 days, and runs at most once per hour under the existing 20-call, five-minute, provider-supported two-dollar ceiling. A SQLite transaction serializes workers and releases its lock after a crash. Failed attempts retain the last valid profile and retry at a later eligible hook. No daemon or remote service is introduced.

The existing profile lifecycle keeps declared and user-authored text active during disagreement. New mined guidance remains a candidate until supported by three independent sessions. Reconciliation proposals remain available for review, and unattended writes cannot replace user-authored text. Automatic learning refreshes recorded native destinations after a successful profile update. Current task context never becomes a global rule by default.

Profile writes are prepared before mutation and recorded as local file revisions with before and after contents. Updates check the original files before applying and roll back completed writes if a later write fails. Undo refuses to overwrite intervening manual edits. History output identifies revisions and change counts; detailed output resolves stored text through the redaction gate. Direct preference recording accepts explicit text and global or current-repository scope through the CLI and local MCP, without a model call. It records active declared guidance and does not authorize execution.

## Files

| Path | Change |
| --- | --- |
| `src/signal/` | Add user steering episodes alongside structural statistics |
| `src/distill/` | Classify evidence and enforce durable user support before reconciliation writes |
| `src/profile/write.ts` | Apply recoverable profile revisions |
| `src/cli/` | Expose automatic learning, direct preferences, history, and undo |
| `src/mcp/` | Expose the same preference and history operations locally |

## Data handling

No capture source is enabled by automatic-learning consent. Existing transcript pointers enter resolveRedacted before excerpts are extracted for the model. Tool results and thinking remain excluded. Worker state stores episode hashes, timestamps, and fixed status labels without transcript text. Local history stores exact profile revisions, including user-authored profile text, under the user's Shadowclone directory and never copies transcripts. History details pass through resolveRedacted before display or model delivery. Internal learner prompts are marked so they cannot become new user evidence, and internal runs cannot enqueue another worker.

## Alternatives

**Treat every stop as negative feedback.** A stop can introduce more requirements or cancel a task and carries no preference by itself.

**Run inference during session startup.** A detached worker preserves interactive latency and leaves the last valid guidance available.

## Accepted costs

Automatic learning is eventual: a missed hook is caught up at the next eligible session boundary. Semantic classification remains fallible and requires labeled evaluation cases. Older history remains available through explicit deep learning. Local revision history can contain private user-authored profile text and is removed by forget.

## Testing

Tests cover bare stops, additive follow-ups, explicit corrections, positive reinforcement, consecutive prompts, task cancellation, repeated sessions, generated input exclusion, and authoritative rule preservation. Worker tests cover disabled consent, duplicate scheduling, failure recovery, interval and batch bounds, scope, and unchanged guidance on failure. Revision tests cover undo, intervening manual edits, and partial-write rollback. Transfer eval uses the same learning stream and retains its earlier-session cutoff. The repository gate and build run before committing.

## Open questions

None.

Validation: the repository gate passes with 359 tests and the bundled CLI builds. Removing the resolveRedacted call at steering materialization made the planted-secret wiring test fail; restoring it passed. No authenticated provider evaluation was run.

## Decision record

Separate observable interruption statistics from semantic preference evidence.

Require durable user support before a learning episode can affect a rule.

Run automatic learning only with explicit consent and bounded resource use.

Reuse profile authority, installation refresh, and transfer evaluation.

Record local revisions and refuse destructive undo after manual edits.
