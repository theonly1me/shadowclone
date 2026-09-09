# Learning Report Boundary

## Summary

`shadowclone learn` indexes enabled sources and reports measured behavior without generating profile instructions. Only explicit deep distillation may create mined rules, the session-end hook rebuilds a compiled view from existing rules, and transfer evaluation uses distilled rules without a structural fallback.

## Problem

The offline learning path turns four coarse event markers into imperative profile rules through fixed templates in `src/profile/rules.ts`. An interruption while `Edit` was active becomes a rule to pause whenever the same tool pattern appears, a refusal becomes a broad instruction about a tool family, and every answered question or resolved plan becomes the same generic advice. These templates discard the surrounding reason, treat one event as a stable preference, and write the result into the user profile as active guidance. The same generator also runs at every Claude session end and acts as a fallback in transfer evaluation, so weak instructions can be manufactured without review and can make the evaluated profile differ from the semantic learner being measured.

## Prerequisites

Design record 006 provides stable profile records and preserves declared, imported, and user-owned guidance independently from newly mined rules.

Design record 007 bounds every deep learning execution by calls, elapsed time, and provider-supported cost.

The existing `allowlistedSignals` and `groupDistillBatches` functions can calculate a deep-learning preview without resolving transcript text or calling an engine.

## Design

`src/profile/rules.ts` and its fixed mapping from `CorrectionSignal` to `ProfileRule` are deleted. `buildProfileRules` leaves the public profile module and every production caller. Structural derivation remains in `src/signal/` because counts and categories are useful evidence in the report even though they are not profile instructions.

Every `learn` run continues to ingest enabled sources into the local SQLite index, derive policy-eligible signals, and check marker health. It then computes the correction moments eligible for deep distillation and their extraction batch count without materializing any `TextRef`. Plain `learn` prints the report and returns before engine detection, distillation, or any profile write. `--dry-run` keeps its stronger boundary by using an in-memory index and writing neither the index nor the profile.

The report states the indexed session count, active day count, corpus size, number of allowed origins, and correction counts for interruptions, permission denials, answered questions, and resolved plans. Existing ranked interruption, denial, and tool categories remain because they are derived labels and counts. The final section states how many correction moments `learn --deep` would send and how many extraction batches that would require. Plain output never says that a profile was written.

`learn --deep` uses the same eligible moments and batches shown by the report. It keeps the existing consent, managed-policy, engine-selection, redaction, checkpoint, and execution-limit boundaries. The only rules it may pass to `writeProfile` are rules returned by `distillSignals`. An empty semantic result writes no generated instruction and has no structural fallback. The report states the number of distilled rules written and whether an engine call occurred.

The Claude `SessionEnd` hook continues to ingest the exact consented transcript path. It reads the hook working directory, resolves that repository with the current Git metadata consent, applies the managed origin blocklist, and calls `compileProfile` for that scope. Compilation reads only existing active profile rules and refreshes `~/.shadowclone/profile/.compiled.md`. It does not derive signals or call `writeProfile`, so ending a session cannot create advice. A missing hook working directory falls back to the current process directory for compatibility with existing hook payloads.

`learnEvaluationProfile` continues deriving corrections from training sessions and running the distiller. It renders only `distilled.rules` into the evaluation profile. An empty distillation result becomes an empty valid profile, so the evaluator remains runnable without substituting structural templates.

The architecture diagram separates `signal -> report` from `signal -> distill -> profile`. It no longer shows a direct signal-to-profile edge.

## Files

| Path | Change |
| --- | --- |
| `src/cli/learn.ts` | Make plain learning report-only and let deep learning write distilled rules only |
| `src/cli/learn.test.ts` | Prove plain learning preserves profile bytes and reports the deep preview |
| `src/cli/profile.ts` | Compile existing rules for the current repository instead of generating rules from signals |
| `src/cli/sessionEnd.ts` | Pass the hook working directory into scoped profile compilation |
| `src/cli/hooks.test.ts` | Prove session end ingests and recompiles without manufacturing advice |
| `src/profile/mirror.ts` | Render origin, correction, deep-preview, and write-result counts |
| `src/profile/rules.ts` | Delete fixed structural rule generation |
| `src/profile/rules.test.ts` | Delete tests for the removed generator |
| `src/profile/index.ts` | Remove the structural generator export |
| `src/signal/index.ts` | Add allowed-origin and correction-kind counts to the report model |
| `src/signal/index.test.ts` | Verify the expanded aggregate report and remove generator tests |
| `src/eval/transfer/profile.ts` | Remove the structural evaluation fallback |
| `src/eval/transfer/profile.test.ts` | Prove an empty semantic result stays an empty valid profile |
| `README.md` | Describe reporting as the plain learning behavior and distillation as the write path |
| `docs/architecture/README.md` | Remove the direct signal-to-profile path from the maintained diagram |
| `docs/architecture/01-capture.md` | Describe the on-demand and session-end trigger behavior |
| `docs/architecture/02-profile.md` | Separate measured structural evidence from mined profile rules |
| `docs/architecture/06-roadmap.md` | Correct the implemented mirror and hook capability claims |
| `docs/design/README.md` | Register this design and its implementation status |

## Data handling

Plain learning reads only sources already enabled by the user and stores the existing event skeletons, cursors, and text pointers in the local disposable index. It does not resolve captured text, call an engine, or write profile content. Its output contains aggregate counts, derived category labels, and tool names, with no transcript paths, working directories, origin identifiers, repository names, or captured excerpts.

Deep learning retains the existing egress path. Eligible `TextRef` values are materialized only by `buildDistillPrompt`, which calls `resolveRedacted`; `resolveRedacted` contains the single `redactSecrets` gate before text reaches the authenticated agent engine. This change adds no network call and no second redaction gate.

Session end reads the exact transcript path supplied by the hook only after Claude source consent and managed policy checks. The adapter stores pointers and event metadata in the local index. Scoped compilation reads the existing local profile and writes the derived `.compiled.md` file locally. Neither the hook nor transfer fallback adds an egress path, telemetry, or raw-content logging.

## Alternatives

**Improve the four fixed templates.** Better wording cannot recover the reason around an event or prove that a single marker is a durable preference. Fixed templates remain unsupported advice, so the generator is removed.

**Keep structural rules until deep learning returns at least one rule.** This hides a failed or empty semantic result behind unrelated behavior and makes evaluation measure a different learner. An empty result remains explicit.

**Stop the session-end hook after ingest.** This avoids profile writes but leaves the compiled artifact stale after the user edits, imports, or changes scope. Recompiling existing rules preserves useful hook work without inventing guidance.

**Resolve excerpts for a richer plain report.** This would turn a local aggregate command into another captured-text materialization path. The report remains count-only and leaves text resolution to explicit deep learning.

## Accepted costs

Users who choose only plain learning receive evidence about their behavior but no automatically mined profile rules. Declared onboarding and repository import remain the zero-model ways to build a profile.

An older profile can retain structural rules written by a previous release because rule origin alone cannot distinguish those templates from semantic mined rules safely. Reconciliation in the next change can assess existing mined guidance against evidence rather than deleting it without proof.

The session-end compiled artifact represents the repository scope of the session that ended most recently. Live session start, install, dispatch, and evaluation still compile for their own target scope before use.

The report adds aggregate fields to `MirrorReport`, which requires updating direct callers and fixtures even though the underlying signal extraction is unchanged.

## Testing

A regression test seeds a profile with declared guidance, runs plain `learn` over a transcript containing a correction marker, and compares every profile file before and after. It fails against the parent branch because structural generation adds an active mined rule. Signal and mirror tests separately assert aggregate correction counts and the deep batch preview.

A deep-learning test returns an empty semantic rule list for a real pointer-bearing correction moment and proves that no structural profile rule appears. The existing successful deep test continues proving that distilled text is written and captured transcript text is absent.

A session-end test starts with one declared rule and a transcript containing an interruption. It proves the transcript is indexed, `.compiled.md` contains the declared rule, and no generated interruption rule appears. Replacing scoped compilation with the old `buildProfileRules` and `writeProfile` path makes this test fail, which is the mutation check for the removed automatic writer.

A transfer-profile test provides a correction moment and an engine result with no rules. It proves the output is exactly an empty valid profile and that no structural text is substituted.

Signal and mirror tests verify allowed-origin counts, all four correction-kind counts, deep preview grammar for singular and plural values, absence of raw working directories, and removal of the profile-written claim from plain output.

Focused CLI, signal, profile, hook, and transfer tests passed during implementation. Final verification passed `bun run check` with 296 tests and 1,527 assertions, built the 309 KB executable bundle, confirmed source and built CLI help, and inspected the 26-file package dry run. The data-handling scan found only aggregate `console` output in the changed paths. Plain learning does not resolve a `TextRef` or call an engine. Deep learning still reaches captured text only through `resolveRedacted` inside `buildDistillPrompt`, and session-end compilation writes only the local derived `.compiled.md` file.

## Open questions

None.

## Decision record

Keep structural signals as measured report evidence and remove their conversion into profile rules.

Make plain `learn` write only the local index and print a count-only report.

Preview deep learning from allowlisted pointer-bearing moments without resolving captured text.

Allow only distilled rules into the mined profile path.

Compile existing scoped guidance at session end without deriving or writing rules.

Keep transfer evaluation runnable with an explicit empty profile when semantic learning returns no rules.
