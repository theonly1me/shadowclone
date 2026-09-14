# Incremental learning repair

## Summary

Profile learning updates what it already knows instead of discarding it. Rules written in the pre-JSON metadata format migrate into the current schema, a write that would silently drop stored rules fails, a requested session is learned from directly, the learning ledger is durable, and catch-up reaches the whole transcript history. Redaction measures entropy before removing a long token, so repository paths survive into evidence.

## Problem

Upgrading to the current metadata format could destroy accumulated guidance. `parseCurrent` requires JSON metadata, so every pre-JSON block fell through to `parseLegacy` and was tagged legacy, and `recordLegacyRetirements` marked every legacy block retired on every `writeProfile` call. A write could therefore remove existing rules without warning while the output reported only additions.

Learning could not rebuild guidance from older evidence. Both selection paths filtered episodes to `now - learningLookback`, a 30-day window, and the worker pruned its processed ledger to the same window. Episodes older than 30 days were unreachable because the filter moved with the clock and the ledger forgot. A single manual run admitted 60 episodes and was stateless, so repeated runs could reread the same newest episodes without progressing through history.

`learn --session` could not learn from the session it was given. The worker selected the 60 oldest unprocessed episodes first and only then narrowed to the requested session keys. A session that just ended sits at the newest end of the corpus, so the intersection was almost always empty and the run completed having learned nothing.

The `high-entropy-string` redaction rule never measured entropy. It matched any run of 40 or more characters from a class that includes `/` and `_`, so ordinary long repository-relative paths could be replaced as secrets. That removed useful locations from learning and code-review evidence.

## Prerequisites

Stored rules carry their original observation and session counts, which the legacy format preserved.

The learning ledger is already sharded by day, so retaining it without a time bound needs no storage change.

## Design

An unedited legacy block migrates into the current schema on write. It keeps its key, title, body, section, scope, origins, observation count, session count, and last-seen date, and it takes empty evidence lists because the old format recorded a confidence decimal instead of evidence identifiers. Its status comes from the same activation policy every mined rule uses, so a rule supported by three or more independent sessions stays active and a thinner one becomes a candidate. An edited legacy block stays user-owned and byte-for-byte unchanged.

`writeProfile` refuses a revision that would remove a stored rule without an explicit retirement. Explicit retirements, user rejections, and rules rewritten into another scope file are all accounted for, so the guard fires only when a rule would vanish for no recorded reason.

Episode selection no longer applies a time horizon, and the worker no longer prunes its ledger by age. Selection returns the oldest unprocessed episodes, so successive runs advance through history in order and never revisit an episode. Manual `learn --deep` reads the same ledger, records what it covered, and reports how many episodes remain.

A requested session is selected from its own episodes directly. The ledger still records only what a run actually processed.

`--max-calls <n>` scales the call ceiling, the time allowance, and the episode ceiling together, preserving the existing per-call ratio at the default of 20. The default run is unchanged at 60 episodes and 10 batches.

The `high-entropy-string` rule reuses `slicedAboveEntropy` with the existing 4.5 bits per character threshold, which the adjacent `shannon-entropy` rule already applies. Tests distinguish low-entropy repository paths from high-entropy token-shaped strings. An entropy threshold does not guarantee that every sensitive string will be recognized.

## Files

| Path | Change |
| --- | --- |
| `src/profile/migrate.ts` | Convert an unedited legacy block into a current-schema rule with empty evidence |
| `src/profile/located.ts` | Derive rule scope and section from a profile relative path for both the snapshot reader and migration |
| `src/profile/lifecycle.ts` | Stop retiring every legacy block on every write |
| `src/profile/write.ts` | Write migrated rules, and assert retention before committing a revision |
| `src/profile/retention.ts` | Report stored rules a revision would drop without an explicit retirement |
| `src/profile/evidence.ts` | Name the independent-session activation threshold once |
| `src/learning/state.ts` | Select the oldest unprocessed episodes with no time horizon and an optional ceiling |
| `src/learning/worker.ts` | Select requested sessions directly and retain the processed ledger |
| `src/cli/learningWindow.ts` | Read the ledger and scale the window with the call ceiling |
| `src/cli/learn.ts` | Record processed episodes and report how many remain |
| `src/cli/learnOptions.ts` | Accept `--max-calls` |
| `src/engine/learning.ts` | Derive scaled learning limits from a call ceiling |
| `src/redact/rules.ts` | Measure entropy before removing a long token |

## Data handling

The redaction change narrows one pattern, so it needs a stated reason. `high-entropy-string` claimed to detect entropy and did not, and the character class it matched includes the path separator. Gating it on the threshold the adjacent rule already uses restores the behavior its name describes. The corpus of adversarial secrets still redacts in full, and the `shannon-entropy` rule continues to cover tokens of 24 characters and above, so no secret shape loses coverage.

Migration reads and rewrites files already inside `~/.shadowclone/profile` and makes no model call. The retained ledger stores an episode fingerprint and a timestamp, never transcript text. Retaining it without a time bound keeps identifiers for episodes the user has already consented to learning from.

## Alternatives

**Keep retiring unedited legacy blocks.** Rejected because the population is mixed. Structural generator output and distilled guidance carry the same metadata fields, so no discriminator separates them, and retiring on that basis removed evidence-backed rules to reach a few weak ones.

**Migrate every legacy block as a candidate.** Rejected because candidates do not compile. A profile that survives migration but reaches no agent is the same outcome as deletion, delayed.

**Remove the path separator from the high-entropy character class.** Rejected because base64 secrets contain that separator, and splitting a secret into segments below the length bound would weaken real detection.

**Let the automatic worker be the only catch-up path.** Rejected because it processes 60 episodes an hour behind a separate consent flag, so a new user with existing history cannot ask for their profile to be built.

## Accepted costs

A migrated rule has no resolvable evidence, so its first reconciliation treats its stored counts as unresolved history and keeps them. Provenance for pre-JSON guidance stays coarser than for rules learned since.

The retained ledger grows by one small entry per processed episode and is never compacted.

A catch-up run large enough to cover a long history takes hours of agent time. Completed batches are checkpointed before the write, so an interrupted run replays them without another model call, but the run applies nothing until every batch finishes.

## Testing

Unit tests cover legacy migration, the activation bar for a migrated rule, migrated guidance surviving a later unrelated write, retention reporting and refusal, requested-session selection with a full older batch, ledger retention beyond 30 days, selection past the former horizon, ledger-aware manual windows, ceiling scaling, path retention through redaction, and a same-length secret still being removed.

Each regression test was mutation-proven by reverting the single condition it guards, printing the reverted line, observing the focused test fail, restoring, and observing it pass.

Migration validation and regression fixtures check that legacy-to-current conversion preserves stored guidance and compiled output.

## Open questions

The default learning allowance assumes 15 seconds per call, which is below what a reasoning model takes for one reconciliation batch, so the time ceiling binds before the call ceiling on a default run. Retuning that ratio is deferred.

The distillation loop applies nothing until every batch completes, so a run stopped by its deadline advances no state. Checkpoints make the retry cheap, and per-batch application is deferred.

## Decision record

Legacy guidance migrates because deletion of learned rules is a worse failure than carrying coarse provenance.

Migrated rules are judged by the same activation policy as any other mined rule because a separate policy for old rules is a second lifecycle to reason about.

A profile write that would silently drop stored rules fails because the original loss was silent and reported success.

Episode selection is ordered oldest first with a durable ledger because the product claims to read the history a user already has, and a window that moves with the clock cannot.

Redaction measures entropy before removing a long token because a rule that removes repository paths degrades the evidence that learning and evaluation both depend on.
