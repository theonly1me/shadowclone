# Deep Learning Reconciliation

## Summary

`shadowclone learn --deep` reconciles new correction evidence with the profile the user already owns. It presents rule-specific support, contradiction, narrowing, and new-rule proposals before writing, keeps declared and user-owned guidance active during disagreement, activates mined guidance only after three independent sessions, and carries evidence on the rule it supports or contradicts.

## Problem

Deep learning currently sends correction batches without the existing profile, accepts a list of unrelated rules, assigns every signal in a batch to every returned rule, and writes the result immediately. A model cannot reinforce or challenge guidance it never sees. A rule inferred from one session becomes active, a rejected paraphrase can return under a new key, and checkpoints remain valid after the prompt or schema changes. `--dry-run` skips semantic learning entirely, while the default command gives the user no diff or decision before profile state changes.

## Prerequisites

Design record 006 provides persistent rule keys, source authority, lifecycle status, proposals, per-rule evidence arrays, rejection state, and compilation that excludes non-active records.

Design record 007 provides one bounded execution shared by extraction and consolidation calls.

Design record 008 provides the seed library and named axes needed to turn disagreement with a declared choice into a concrete sibling proposal.

Design record 011 removes structural rule generation, leaving deep learning as the only path from observed corrections to mined rules.

## Design

The reconciliation input has two local views. The writable view contains parsed profile rules and rejection records exactly as they exist on disk. The prompt view reads the same files through `FileTextRef` and `resolveRedacted` before parsing them. The learner uses prompt-view titles and bodies for model input and writable-view records only when applying validated verdicts. Profile content therefore uses the same single redaction gate as transcript excerpts.

Profile discovery scans only Markdown beneath `global/` and `org/`. It ignores `.compiled.md` and rejects paths outside the closed profile shape. Standard section filenames recover `engineering`, `workflow`, or `boundaries`; exact project files recover `engineering`, which is the only section repository import currently writes. Rules without persistent metadata remain user text outside automated reconciliation.

Each distillation batch is scoped by origin and exact repository. Global rules, matching organization rules, and an exact matching project rule enter that batch. A project rule never enters evidence from another repository under the same owner. Correction signals gain the safe project profile filename already derived by repository resolution, while the prompt receives no origin, repository name, working directory, source path, or local rule key.

The model sees opaque `rule-N`, `rejection-N`, `option-N`, and `evidence-N` tokens. A local context maps those tokens back to persistent rule keys, rejection keys, seed choices, and durable evidence identifiers. Evidence tokens identify one correction moment in the prompt. A returned token is accepted only when it belongs to that batch; unknown rule, rejection, option, and evidence tokens are discarded.

Seed keys map to their package-owned axis and sibling choices. The prompt names the current choice and sibling titles and bodies using opaque option tokens. A contradiction or narrowing verdict may select a sibling token, producing a concrete proposal from package-owned text. Free-form declared, imported, mined, and user-owned rules use model-proposed title and body text instead.

The reconciliation output has two arrays. `existingRules` carries a rule token, a verdict of `reinforces`, `contradicts`, or `narrows`, a short observed comparison, the evidence tokens specific to that verdict, optional proposed text, and an optional axis choice token. `newRules` carries title, body, section, observed comparison, evidence tokens, and an optional matching rejection token. New guidance marked as equivalent to a known rejection is omitted before it receives a profile key.

Reinforcement unions returned evidence into `evidence.for`. Contradiction and narrowing union it into `evidence.against` and attach a `revise` or `narrow` proposal. Declared, imported, and user-owned rules stay active when evidence disagrees. Contradicted mined rules become stale. Other mined rules are active only when their supporting evidence resolves to at least three distinct origin and session pairs; below that threshold they are candidates. Observations, sessions, origins, and last-seen values are recomputed from evidence that can be resolved, while prior values are retained when older evidence uses an unknown legacy shape.

New mined rules start in the batch origin at organization scope. They receive only the evidence tokens returned for that rule. Three independent sessions make them active; one or two make them candidates. Consolidation merges only new mined rules, retains the first persistent key, and unions the exact evidence arrays of the source indices returned by the bounded merge call. Updates to the same existing rule across batches also union evidence by persistent key.

`checkpointId` hashes the complete redacted prompt, output schema, and a named learner version. The prompt already includes existing rules, axis choices, rejected guidance, and evidence, so any relevant learner change invalidates stale output. Checkpoints store parsed reconciliation output, never prompts or excerpts. New mined keys derive deterministically from the local scope, returned guidance, and validated evidence, so replaying a checkpoint preserves identity. Dry runs disable checkpoint reads and writes.

Plain `learn` remains the report from design record 011. `learn --deep --dry-run` uses an in-memory index, runs bounded reconciliation, prints the profile comparison, and writes no index, checkpoint, or profile state. Default deep learning prints the same comparison and asks once before applying it. Declining leaves the profile unchanged. `learn --deep --apply` applies without the confirmation prompt. `--apply` requires `--deep` and cannot be combined with `--dry-run`.

The comparison names the current source, current guidance, observed pattern, proposal, lifecycle status, and support or contradiction count for each changed rule. It prints model-derived text only after input redaction and never prints raw excerpts or stable local identifiers.

## Files

| Path | Change |
| --- | --- |
| `src/signal/types.ts` | Carry the safe exact-project profile name on correction signals |
| `src/signal/corrections.ts` | Attach repository scope while mining each correction moment |
| `src/signal/index.ts` | Pass resolved repositories into correction mining |
| `src/profile/snapshot.ts` | Read writable and redacted reconciliation views from the profile |
| `src/profile/evidence.ts` | Parse durable evidence identifiers for session and origin counts |
| `src/profile/mirror.ts` | Distinguish proposed rules from an accepted profile write |
| `src/profile/state.ts` | Parse rejection state from already redacted text |
| `src/profile/write.ts` | Permit metadata-only reconciliation updates to edited user-owned rules |
| `src/distill/reconcile/types.ts` | Define prompt context, verdict, change, and result contracts |
| `src/distill/reconcile/context.ts` | Map local profile, rejection, axis, and evidence identities to opaque tokens |
| `src/distill/reconcile/prompt.ts` | Render redacted evidence and existing guidance for the model |
| `src/distill/reconcile/schema.ts` | Validate rule-specific verdicts and proposals |
| `src/distill/reconcile/apply.ts` | Apply authority, evidence, proposal, threshold, and rejection rules |
| `src/distill/reconcile/render.ts` | Render a local review diff without raw excerpts or local identifiers |
| `src/distill/aggregate.ts` | Union repeated updates to one persistent rule |
| `src/distill/consolidate.ts` | Preserve identity and exact evidence while merging new rules |
| `src/distill/index.ts` | Run reconciliation under one bounded execution and consolidate new rules |
| `src/distill/checkpoint.ts` | Bind checkpoints to prompt, schema, and learner version |
| `src/distill/merge.ts` | Bind consolidation checkpoints and union source-rule evidence |
| `src/distill/profile.ts` | Remove the batch-wide evidence attribution path |
| `src/cli/learn.ts` | Add review, confirmation, dry-run, and direct-apply behavior |
| `src/cli/deepLearn.ts` | Isolate bounded semantic review from indexing and reporting |
| `src/cli/index.ts` | Parse and validate `learn --apply` |
| `src/cli/learnOptions.ts` | Reject invalid deep-learning flag combinations before work starts |
| `src/cli/init.ts` | Name redacted profile guidance in deep-learning consent |
| `src/eval/transfer/profile.ts` | Compile only active reconciled rules into the temporary evaluation profile |
| `README.md` | Document reconciliation, review, and apply behavior |
| `docs/architecture/02-profile.md` | Replace extraction-only deep learning with the reconciliation contract |
| `docs/architecture/03-engine.md` | Name reconciliation and consolidation as the shared bounded execution |
| `docs/architecture/05-privacy.md` | Document redacted profile input and opaque prompt identities |
| `docs/architecture/06-roadmap.md` | Mark reconciliation behavior in the implemented learning phase |
| `docs/architecture/07-enterprise.md` | Tighten the batch boundary to an exact repository scope |
| `docs/design/README.md` | Register this design and its implementation status |

## Data handling

The feature reads enabled transcript pointers, local profile Markdown, local lifecycle state, and package-owned seed guidance. Transcript text enters a prompt only when `buildReconciliationPrompt` resolves an allowlisted `TextRef`. Existing profile and rejection text enters a prompt only from a whole-file `FileTextRef` resolved by `resolveRedacted`. The single `redactSecrets` gate remains inside `resolveRedacted` for both paths.

The model sees redacted text plus opaque per-prompt tokens. It does not receive transcript paths, profile paths, working directories, Git remotes, origin identifiers, repository names, persistent rule keys, durable evidence identifiers, or rejection keys. Checkpoints contain validated verdicts and proposals with no excerpt text. Local terminal output may show redacted model summaries and proposed rule text because review is the user control surface for the explicit deep-learning action.

Default and applied runs store profile changes and checkpoints under the existing user-owned Shadowclone directory. Dry run uses an in-memory index, disables checkpoints, and stores no result. No telemetry or new network path is added. Engine calls remain isolated with no tools and pass through the bounded learning runner.

## Alternatives

**Generate a fresh profile and replace the old one.** This erases declared intent, edits, imports, rejections, and stable identity. Reconciliation treats the existing profile as owned state.

**Send raw profile files because the user can already read them.** Readability is not egress consent, and profiles can contain pasted secrets. The prompt view goes through the same redaction gate as transcript evidence.

**Expose persistent keys and origin identifiers to simplify model output.** Those identifiers reveal selected preferences and repository ownership. Opaque prompt tokens keep correlation local.

**Activate a mined rule after one occurrence.** A single correction can be task-specific or accidental. Three independent sessions is the fixed evidence threshold for active mined guidance.

**Use string similarity to block rejected paraphrases.** Token overlap misses semantic paraphrases and can suppress unrelated rules. The model sees redacted rejected guidance and returns the matching opaque rejection token, which the host validates.

**Write immediately after the engine returns.** This repeats the current loss of user control. Default deep learning shows the complete change set before one explicit confirmation.

## Accepted costs

Handwritten Markdown blocks without persistent metadata cannot receive automated evidence or proposals. They still compile as user guidance and remain untouched.

Project-file section recovery depends on repository import currently writing project guidance as engineering rules. A later general project-rule editor must persist section metadata before adding other project sections.

Rejection paraphrase protection depends on the semantic learner identifying the matching rejection token. Exact identity remains deterministic, while semantic equivalence is only as accurate as the bounded model result.

Existing evidence identifiers from an unknown legacy shape remain stored but cannot contribute a newly computed session count. New evidence uses the resolvable versioned shape.

The default command spends its bounded model allowance before asking whether to apply the resulting local profile diff. The prior deep-learning consent and explicit command authorize that analysis; confirmation controls the write.

## Testing

Recorded engine results cover reinforcement, free-form contradiction, axis-backed narrowing, new guidance, unknown tokens, and matching a rejected paraphrase. Prompt assertions prove existing rules, rejected guidance, axis siblings, and redacted excerpts are present while secrets, paths, origins, persistent keys, and durable evidence ids are absent.

Rule application tests prove evidence attaches only to the rule that names it, evidence unions across batches and consolidation, two sessions produce a candidate, three produce an active mined rule, contradicted declared and user-owned rules remain active with proposals, and contradicted mined rules become stale.

CLI tests prove default review declines without profile writes, confirmation applies the shown changes, `--apply` skips confirmation, semantic dry run writes no database, checkpoint, or profile files, and invalid flag combinations fail before learning.

Profile lifecycle tests prove a metadata-only proposal update preserves edited user text. Rejection tests restore a new-rule result that names a semantically matching rejection and prove no new key or Markdown block is written.

Checkpoint tests change the prompt, schema, and learner version independently and prove each change produces a different id. Repeated identical inputs reuse the checkpoint without another engine call. The existing call, deadline, and provider-supported cost tests continue to cover the complete reconciliation and consolidation execution.

Focused tests run during implementation, followed by `bun run check`, build, source and built CLI help, and package dry run. The data-handling scan accounts for every prompt, file read, write, and console output added by this change.

Final verification passed `bun run check` with 310 tests and 1,591 assertions, built the 323 KB executable bundle, confirmed the same `--deep`, `--dry-run`, and `--apply` help from source and built entry points, and inspected the 26-file package payload. Focused tests prove authority preservation, concrete axis and free-form proposals, three-session activation, rule-specific evidence union, semantic rejection matching, exact-project scoping, checkpoint invalidation, metadata-only updates, confirmation control, and a write-free semantic dry run. The data-handling scan found one prompt builder: transcript pointers and whole profile files reach it only through `resolveRedacted`, while persistent identities stay behind local opaque tokens.

## Open questions

None.

## Decision record

Reconcile new evidence against existing profile and rejection state instead of regenerating a profile.

Read every user-owned text input to the model through `resolveRedacted` and keep all persistent identities local.

Use named seed axes to produce concrete sibling proposals while supporting free-form rules.

Attach only validated returned evidence tokens to each rule.

Require three independent sessions before mined guidance becomes active.

Keep declared, imported, and user-owned guidance active when evidence disagrees and record the disagreement as a proposal.

Bind checkpoints to the redacted prompt, output schema, and learner version.

Show the reconciliation diff before writing unless the user supplied `--apply`.
