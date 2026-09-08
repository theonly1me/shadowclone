# Give profile rules persistent identity and an explicit lifecycle

## Summary

Profile rules become versioned records whose identity survives wording changes. Each generated Markdown block records its source, lifecycle status, pending proposal, applicability conditions, and deduplicated supporting and contradicting evidence. The writer treats creation, revision, pinning, rejection, and retirement as distinct state transitions, migrates edited 0.0.5 blocks as user-owned text, and retires unedited 0.0.5 template output instead of presenting it as valid learning.

## Problem

`semanticRuleKey` hashes a generated title. Rewording the same preference therefore creates a different identity, while deleting the old wording rejects only its old hash. The writer can regenerate the deleted preference under a paraphrased title and cannot distinguish a revision from a new rule.

`isDistilledRule` repeats the title hash to infer which generator owns an existing block. Pruning therefore depends on wording and identity agreeing by accident. The profile record itself does not state whether the rule was declared, imported, mined, or handwritten.

The metadata comment carries `confidence`, but the number has two incompatible definitions. `buildProfileRules` calculates observations divided by opportunities, while `distillSignals` calculates independent sessions divided by three. `confidenceThreshold` has no caller. A decimal with two meanings cannot explain why a rule is active or why the compiler selected it.

The record has no representation for a candidate, stale guidance, a pending revision, applicability conditions, or contradicting evidence. `.rejected` stores only a relative path and key, so later reconciliation has no text to compare with a new candidate. The writer also cannot recover a deleted block's text after deletion because `.generated` stores the same two fields.

Profiles written by 0.0.5 contain template rules generated directly from structural events. Importing those blocks as active mined preferences would give unsupported advice the authority of the new record model. Edited blocks are different because their visible wording is a user correction that must survive byte for byte.

## Prerequisites

The capture and capability truth change must remain below this change because it establishes the design-record workflow and documents the current profile lifecycle that this record replaces.

## Design

`ProfileRule.key` is an opaque persistent identifier. A producer assigns it once when a preference is first created, and every revision carries the same value. `createProfileRuleKey` uses a random UUID for semantic candidates. The temporary structural generator keeps its existing evidence-derived key until that generator is removed, but title text no longer participates in identity anywhere.

The profile record adds four source values. `declared` is guidance shown to and accepted by the user, `imported` came from a user-selected rules file, `mined` came from observed behavior, and `user` is handwritten or pinned text. Source records ownership and authority. It does not encode whether evidence agrees with the rule.

The status values are `active`, `candidate`, and `stale`. The compiler emits active records and handwritten blocks. It withholds candidate and stale records. Contradiction does not create a status: an active declared or user rule remains active and gains a proposal containing `revise`, `narrow`, or `retire` plus the suggested text. A pending proposal never overrides the user's active instruction.

`appliesWhen` is an ordered list of explicit conditions. This PR preserves it through rendering and parsing. Task-aware condition evaluation belongs to the bounded compiler change because the current compiler has no task context.

Evidence is stored as separate `for` and `against` identifier lists. Rendering deduplicates each list before deriving the `supports` and `contradicts` counts, so counts cannot be inflated by repeating one identifier. The identifiers are opaque to the Markdown writer and remain available to the later reconciliation resolver. Empty lists state that a migrated record has no resolvable evidence instead of fabricating provenance.

Generated metadata is one JSON object inside the existing HTML comment. It carries schema version 1, identity, source, status, proposal, applicability, evidence counts and identifiers, observation totals, timestamps, sessions, origins, scope, and the visible-text fingerprint. JSON string content that could terminate an HTML comment is escaped before rendering. The visible Markdown remains the canonical editable profile surface.

`.generated` becomes a versioned JSON Lines ledger. A present entry stores the relative path, key, last generated title and body, source, and `present` disposition. Keeping the last generated text lets deletion create a complete rejection after the Markdown block is gone. A `retired` entry is a tombstone that prevents an obsolete generator from immediately recreating the same identity. The reader accepts the 0.0.5 tab-separated path and key format as a legacy present entry.

`.rejected` becomes versioned JSON Lines with relative path, key, source, title, and body. A new rejection therefore gives later reconciliation the concept that the user removed. A legacy tab-separated rejection is preserved with null source, title, and body. No missing provenance is invented.

The write transitions are explicit:

| Operation | Markdown | `.generated` | `.rejected` |
| --- | --- | --- | --- |
| Create | Add the new block unless its key is retired or rejected | Add a present entry with generated text | Unchanged |
| Revise | Replace an unedited block while retaining its key | Replace the present entry with the new text and path | Unchanged |
| Pin | Preserve an edited generated block byte for byte | Remove generated ownership | Unchanged |
| Reject | Keep a generated block deleted when the same identity is proposed again | Remove the present entry | Add the last generated source, title, and body |
| Retire | Remove an unedited obsolete block through an explicit retirement | Keep a retired tombstone | Unchanged |

Absence from one generator run is no longer enough to retire a record. Retirement is explicit because source describes provenance rather than a specific implementation, and later reconciliation must make the lifecycle decision. Existing callers can continue to create and revise rules through `writeProfile`; future reconciliation can pass explicit retired identities.

Migration runs when the writer opens a legacy block. An unedited legacy block is removed and its key becomes a retired tombstone, including when the old generator proposes the same key during that write. An edited legacy block is interpreted as `source=user`, remains active, leaves generated ownership, and is preserved byte for byte. Handwritten blocks without metadata remain user-owned and active. A missing legacy generated block still becomes a legacy rejection with only path and key because 0.0.5 did not retain its text.

`parseProfileBlocks` returns typed lifecycle data rather than making the compiler search raw comment text. Malformed or incomplete metadata is treated as a handwritten block so a local edit cannot silently delete user text. `buildCompiledProfile` removes the unused confidence threshold and selects typed active records. A declared rule with contradicting evidence and a pending proposal remains in the compiled profile.

## Files

| Path | Change |
| --- | --- |
| `docs/design/006-profile-record-lifecycle.md` | Record the profile identity, schema, state, migration, and write contracts |
| `docs/design/README.md` | Add this record to the chronological index |
| `docs/architecture/02-profile.md` | Replace confidence and title-derived identity with the implemented record and lifecycle |
| `docs/architecture/03-engine.md` | Describe active-status selection instead of a confidence threshold |
| `README.md` | State the richer rejection behavior and the remaining semantic-match boundary |
| `src/profile/types.ts` | Define source, status, proposal, evidence, lifecycle, and state types |
| `src/profile/render.ts` | Render schema version 1 metadata and assign semantic rule identifiers |
| `src/profile/parse.ts` | Parse versioned and legacy blocks without losing local edits |
| `src/profile/state.ts` | Read legacy state and persist versioned generated and rejection ledgers |
| `src/profile/write.ts` | Apply create, revise, pin, reject, retire, and legacy migration transitions |
| `src/profile/inject.ts` | Compile active typed records and remove confidence filtering |
| `src/profile/rules.ts` | Populate the new mined record fields for the temporary structural generator |
| `src/distill/index.ts` | Assign stable semantic candidate identifiers and populate the new fields |
| `src/distill/checkpoint.ts` | Validate checkpoints against the new record schema |
| `src/cli/profile.ts` | Preserve the structural refresh boundary explicitly |
| `src/profile/*.test.ts` | Cover metadata, lifecycle, migration, stable identity, and compilation |
| `src/distill/index.test.ts` | Replace the confidence assertion with lifecycle and evidence assertions |
| `src/cli/hooks.test.ts` | Build the new profile record shape |
| `src/cli/install.test.ts` | Build the new profile record shape |

## Data handling

This change reads and writes only the existing local profile Markdown, `.generated`, `.rejected`, and distillation checkpoint files under `~/.shadowclone/`. It stores rule text in `.generated` and `.rejected` so deletion and later semantic rejection can be represented after the visible block is gone. Rule text is derived guidance already stored in the profile, not transcript content or an excerpt.

No new capture source or network call is added. Evidence identifiers are stored without resolving or materializing their source text. Existing distillation remains the only egress path and continues to pass materialized transcript excerpts through `resolveRedacted` before an engine call.

## Alternatives

**Keep hashing the title and add the body to the hash.** Rejected because any useful edit still changes identity, and a larger wording hash makes the same lifecycle defect less obvious rather than fixing it.

**Use confidence with one normalized formula.** Rejected because activation is a policy based on source, independent sessions, contradiction, and user ownership. Compressing those reasons into one decimal hides the decision the user needs to inspect.

**Treat every 0.0.5 block as active mined guidance.** Rejected because the old structural generator turns event categories directly into instructions. Migration must not grant that output the authority of evidence-backed learning.

**Rewrite edited legacy blocks with new metadata.** Rejected because the user may have edited any byte in the block, including layout or metadata. Migration can assign user ownership in memory and state without changing their text.

**Put profile records in a database.** Rejected because readable and editable Markdown is the user control surface. JSON Lines is limited to the two hidden lifecycle ledgers that make Markdown deletion meaningful.

## Accepted costs

The generated ledger duplicates the last generated title and body, and the rejection ledger retains removed guidance. This is required for deletion and paraphrase reconciliation, and `forget` already removes both with the profile directory.

Retired tombstones remain in `.generated` until a later lifecycle compaction exists. They are small and prevent obsolete identities from returning during the transition away from the structural generator.

Legacy rejections cannot participate in semantic comparison because 0.0.5 did not store their text. They continue to reject the same key and expose null text rather than invented history.

Condition evaluation remains deferred because the current compiler receives repository scope but no task context. The field is durable now so imports and declared rules do not need another representation migration later.

## Testing

Rendering and parsing round-trip every new field, deduplicate repeated evidence identifiers, and derive matching support and contradiction counts. An adversarial proposal containing an HTML comment terminator cannot escape the metadata comment.

A 0.0.5 fixture contains one unedited generated block and one edited block. Migration removes and retires the unedited template, preserves the edited block byte for byte as an active user rule, and does not invent evidence or rejection text.

Lifecycle tests revise a title while retaining its assigned key, delete a generated rule, propose revised wording under that key, and confirm the richer rejection prevents recreation. Explicit retirement removes an unedited block without recording user rejection. Existing pin and handwritten preservation tests remain.

Compilation tests prove candidate and stale rules are omitted while an active declared rule with contradicting evidence and a pending proposal is still emitted. The regression tests are mutation-checked by restoring title-derived identity, allowing a rejected key through, and filtering active rules with proposals, then observing each focused failure before restoring the implementation.

The final gate is `bun run check`. The architecture overview Mermaid diagram is reviewed and remains accurate because this change alters the data carried by the existing profile node without adding a stage, dependency, trust boundary, or execution path.

## Open questions

None.

## Decision record

2026-09-08: Assign profile identity once and carry it across revisions because generated wording is mutable state rather than identity.

2026-09-08: Replace confidence with explicit source, status, proposal, and evidence because activation and disagreement must remain inspectable.

2026-09-08: Retire unedited 0.0.5 template blocks and preserve edited blocks as user-owned text because migration cannot turn old heuristics into valid learning.

2026-09-08: Store the last generated text in local lifecycle ledgers because deletion otherwise destroys the information needed to honor rejection after rewording.
