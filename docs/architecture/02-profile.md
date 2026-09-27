# Learning and skill delivery

Durable learning is stored in `~/.shadowclone/environment.json` and published into skills. Native instructions require a baseline and route tasks to relevant workflows.

## Evidence and reconciliation

Learning records retain guidance, scope, observations, source hashes, rejection state, and publication destinations. Evidence is kept independently of the instruction budget so a failed or deferred publication does not lose it.

Reconciliation uses redacted user steering and bounded supporting context. Explicit durable guidance can activate after one session; inferred behavior needs three independent sessions. Questions, silence, temporary exceptions, and interruptions alone do not establish a preference. Contradictory evidence creates a review decision instead of silently replacing an explicit instruction.

Plain `learn` reports structural evidence. Deep and separately consented background learning call the model. `remember` stores a direct preference without inference. A stored record may still be waiting for publication; `skills pending` and `context --explain` expose that state.

## Publication

The planner first searches the consented library for a matching workflow. It reads selected skills through redaction and proposes exact section edits. When no workflow fits, it can create an instruction-only skill. Unrelated text, invocation settings, resources, and conditional requirements remain intact.

Universal guidance belongs in `shadowclone-baseline`. Task skills contain procedures, prerequisites, preferences, and examples. Short scoped facts can appear in native context. The baseline and native sections each have a 4 KiB ceiling. Other skill limits include 48 KB and 500 lines. Overflow stays visible and retains its evidence.

Automatic supported edits to user skills require write authorization. Conflicts, ambiguous edits, unsafe references, and uncertain technical claims remain pending. Third-party packages receive local companions tied to selection of the original skill.

## Scope and ownership

Global output contains global learning only. Project output requires a registered repository with verified Git identity. Organization guidance remains within its remote-owner scope. Imported repository instructions remain evidence without being republished as duplicate behavior.

Global skills use the canonical personal library with provider-specific copies. Repository skills stay under registered roots. Copies preserve supporting bytes and executable permissions. A single manual edit can be synchronized; divergent edits remain conflicts.

Publication groups skill files, resources, native instructions, and evidence decisions into one revision. Fingerprints detect intervening edits, failed writes roll back completed writes, and undo refuses later conflicts.

## Builds and memory

Terminal and browser builds publish explicit selections through the same revision machinery. Global builds provide personal defaults; private and shared repository builds have separate output. Shared requirements remain protected from private overrides.

Recurring Claude memory extraction requires the named source and a registered, matching repository. Hashes avoid reprocessing unchanged notes. Memory is read-only, and temporary task state does not become durable guidance.

## Compatibility

Migration freezes original skills and native instructions, retains legacy learning, and publishes in bounded batches. Delivery switches only after coverage and file validation. Legacy profile files remain recovery artifacts; unmigrated installations continue using their compiler. See [migration](../migration.md).

Hooks, optional subagents, dispatch, and MCP use the active delivery path. `shadowclone_context` returns scoped routing; `shadowclone_profile` remains a deprecated alias. Historical evaluators retain their original profile semantics. The [skills evaluation protocol](09-evaluation.md#skills-environment-protocol) freezes original and maintained libraries separately.
