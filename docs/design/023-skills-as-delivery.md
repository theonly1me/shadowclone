# Skills as the learning delivery format

## Summary

Shadowclone reconciles durable learning into portable skills and small native routing sections. A mandatory baseline skill carries universal guidance. Local evidence and revision records support explanation and undo without an aggregated profile in agent context.

## Problem

The profile compiler compresses all active guidance into one startup budget. Skill maintenance subsequently copies profile fragments into existing skills, so details lost during profile formation cannot improve those workflows. It cannot create a missing workflow from learning. Maintaining both representations also obscures which instructions an agent actually used.

## Prerequisites

Source consent and managed policy continue to govern reading and model access. Automatic maintenance requires separate write authorization. Existing installations retain their delivery until an explicit, validated migration switches them.

## Design

Implementation proceeds through internal learning storage, evidence-backed skill planning, reversible publication, native delivery, migration, and evaluation isolation. Existing uncommitted changes and historical evaluation receipts are preserved.

Versioned local learning records retain complete guidance, scope, evidence, rejections, source hashes, and publication destinations. The existing reconciliation thresholds remain: explicit durable steering can activate after one session, while inferred patterns need three independent sessions. Pending publication survives a completed capture batch.

The planner reviews the consented library, updates relevant sections and descriptions, and creates instruction-only skills when no existing workflow fits. It preserves unrelated text, supporting resources, permissions, and invocation settings. Supported changes to authorized user skills apply automatically. Conflicts and uncertain technical claims remain pending. Third-party skills receive local companions without modifying their packages.

A small baseline skill contains universal guidance. Native instruction sections require the baseline and route applicable tasks to skills. Workflow prerequisites stay with the procedure. Necessary standalone facts remain scoped native context. Native sections and the baseline each have a 4 KiB ceiling. Other skills retain the existing structural limits. Overflow is visible and never silently truncates evidence.

Global skills contain global learning only. Repository skills are published only to registered matching repositories. Organization records retain their owner boundary. Portable copies preserve divergent manual edits. Skill files, native sections, and publication records form one reversible revision.

Consented Claude memory extraction runs during learning for registered repositories. Source hashes prevent repeated processing. Native memory is never written, deleted, or restored. Temporary task state does not become durable guidance.

The migration command previews by default and applies with explicit selection. It freezes the original skill library and instructions, maps active profile entries and references, records unresolved scopes, validates coverage, and switches delivery only after publication succeeds. Legacy profile files remain recovery artifacts. The active learning and delivery paths no longer maintain an aggregated Markdown profile.

Context diagnostics report skills, routing, facts, provenance, and pending changes. Native hooks retain session attribution and learning lifecycle duties. Dispatch, MCP, optional subagents, and repository harnesses share the new delivery path. The old MCP profile name remains a deprecated context alias. Historical evaluators retain their frozen profile semantics.

## Files

| Path | Change |
| --- | --- |
| `src/learning/` | Durable learning and resumable publication |
| `src/skillMaintenance/` | Reconcile complete workflows and create missing skills |
| `src/integrations/` | Native baseline and routing delivery |
| `src/migrate/` | Reversible conversion and baseline preservation |
| `src/eval/` | Freeze distinct original and maintained skill environments |

## Data handling

All model-bound source content passes through the existing resolveRedacted boundary. Source consent does not silently authorize skill writes or additional capture roots. Memory extraction uses explicitly configured repositories and the named memory source. Local learning, backups, revisions, and evaluation snapshots remain outside the public checkout. Public fixtures are independently authored synthetic examples. No telemetry or automatic remote publication is added.

Publication includes a review of the complete diff, new files, filenames, commit history, and package contents for private source material. Private evaluation notes stay outside the checkout. Any fixture copied from a private workflow is replaced with an independently authored scenario before publication.

Bundling TypeScript otherwise embeds the build machine's absolute module paths in the published executable. Bind its CommonJS module paths to the installed bundle at runtime, then reject build output containing the source directory or home directory before writing it. A real bundle test checks the resulting artifact and executes its TypeScript parser after relocation.

## Alternatives

**Keep profile injection alongside skills.** Rejected because duplicate behavioral sources preserve the original context-budget problem.

**Create one skill per correction.** Rejected because overlapping triggers make selection unreliable. Learning updates an existing coherent workflow first.

## Accepted costs

Skill selection becomes part of correctness. Native import and explicit-read behavior differ between providers and require separate delivery checks. Automatic editing needs evidence, fingerprint checks, and reversible revisions. A migration can leave unresolved scope records unpublished until their repository is registered.

## Testing

Tests cover skill updates and creation, baseline routing, memory idempotency, scope isolation, evidence retention, source consent, redaction, symlink rejection, conflicts, interrupted publication, and undo. Focused regression tests demonstrate failure without the protected behavior. The repository gate and executable build precede local rollout. Native checks use isolated synthetic sessions before personal-data evaluation.

Later evaluations freeze bare, original skills, original skills with memory, and maintained skills with native routing. The maintained condition receives no profile overlay. Original and maintained libraries remain distinct, historical receipts are unchanged, and paid execution is a subsequent phase.

## Open questions

None.

## Decision record

Skills are the behavioral delivery format; internal records retain evidence and history.

Universal guidance lives in a mandatory baseline skill.

Supported changes to the user's skills apply automatically after write authorization.

Claude memory is a recurring consented input and is never an output.

The current installation is migrated with backups before subsequent evaluations.
