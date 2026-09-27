# Guidance and memory evaluation

## Problem

The earlier transfer evaluation supplied a folder pointer without a usable skill catalog, combined skills with native memory, and measured coding conventions without testing learned knowledge. It could not establish whether Shadowclone improved skill selection or replaced memory.

## Protocol decision

Add a separate `guidance-v1` protocol with frozen repository state, task requirements, sources, model, and effort. Preserve historical transfer receipts.

| Condition | Inputs |
| --- | --- |
| Bare | Task and repository-native guidance |
| Skills | Bare plus personal instructions and a skill catalog |
| Claude memory | Skills plus a verified frozen memory snapshot |
| Shadowclone | Skills plus the production bootstrap, profile, and scoped references |

Freeze four reviewed cases: two code tasks and two advice tasks. The pilot uses one of each across four conditions once; repeated comparisons use two repetitions. Skill bodies stay identical and are read on demand. Block live memory, profiles, ambient hooks, and external MCP access.

Each case has visible completion requirements and at most eight source-backed grading criteria. Keep correctness, safety, routing, preferences, and memory accuracy separate. Deterministic checks handle exact syntax constraints; other criteria receive two blinded votes, with disagreement left unresolved. Tests that were not executed remain unverified.

Count a skill or reference read only after a successful tool result. Track whether reading preceded editing, allowing unknown timing. A migration's coverage label does not prove source preservation or behavioral parity.

Persist private sources, candidates, votes, and accounting. Freeze limits and stop on unknown cost, exhaustion, model mismatch, or isolation failure. Resume reuses saved work without resetting spend or deadlines. Judge source packets are capped at 64 KiB and identical across conditions. Public reports contain reviewed results and limitations, never raw private receipts.

## Schema compatibility and measurement repairs

The initial pilot produced one candidate before Claude rejected a Draft 2020-12 judge schema. The failed call had unknown cost, so the ledger stopped further execution. This was a harness failure and yielded no comparison.

The repair used Draft 7 and an installed-CLI contract probe against a loopback-only mock with synthetic credentials and inputs. It demonstrated that the rejected schema failed before a messages request. Explicit audited recovery preserved the original candidate, receipt, call count, and spend, reconciling only that verified rejection as zero-cost. It allowed one bounded deadline renewal, without changing ordinary resume.

Read tracking then needed canonical-path matching: `/var` and `/private/var` could identify the same successful read. Successful mutation events replaced guessed shell-write timing. Historical counts stayed unchanged and were labelled unreliable.

Judging also needed fuller evidence. Short source quotations omitted historical verification, which a judge misread as a claim of new execution. Later packets included complete frozen memory bodies and path-existence evidence. Judge version 4 separated required-workflow compliance from technical validity: choosing another workflow can violate an instruction without proving the chosen command cannot run. Versions 2 and 3 and their completed votes remained unchanged. Offline fixtures checked this contract and its wiring, not model reasoning accuracy.

## Recorded comparisons

These runs used Sonnet 5 at medium effort on the two diagnostic cases. The maintained-reference comparison corrected one managed repository path through revision history. It therefore measures explicitly directed maintenance with different reference content, not equal-fact delivery or autonomous repair.

| Stage | Candidates / judge responses | New calls | New cost | Cumulative calls / cost |
| --- | --- | ---: | ---: | --- |
| Recovered pilot | 8 / 16 | 25 including the initial attempt | $2.9722378 | 25 / $2.9722378 |
| Measurement validation | 16 / 32 | 48 | $6.5293998 | 73 / $9.5016376 |
| Maintained reference | 16 / 32 | 48 | $7.2567122 | 121 / $16.7583498 |

Preference checks passed:

| Stage | Bare | Skills | Claude memory | Shadowclone |
| --- | ---: | ---: | ---: | ---: |
| Recovered pilot | 2/5 | 5/5 | 5/5 | 4/5 |
| Measurement validation | 4/10 | 9/10 | 10/10 | 9/10 |
| Maintained reference | 6/10 | 9/10 | 10/10 | 9/10 |

Shared-memory checks:

| Stage | Bare | Skills | Claude memory | Shadowclone |
| --- | --- | --- | --- | --- |
| Recovered pilot | 3/4 | 3 pass, 1 unresolved | 4/4 | 4/4 |
| Measurement validation | 6/8 | 7/8 | 7 pass, 1 unresolved | 6 pass, 1 fail, 1 unresolved |
| Maintained reference | 5 pass, 2 fail, 1 unresolved | 6/8 | 6/8 | 8/8 |

The pilot's Shadowclone candidate used a prohibited type assertion. Its read counts could not establish skill non-use because of the path bug. Validation confirmed required-skill reads in all skill-enabled code responses, but four of six had unknown edit timing. In the maintained-reference run all six read the skill with unknown timing; Shadowclone still used a prohibited cast and changed package exports outside the task. Skills also had a type-check failure. Snapshot safety checks passed, while runtime correctness remained unverified.

These comparisons fell short of the stated improvement target. Shared-memory gains from a corrected reference do not establish general memory parity, and unresolved judgments limit conclusions. A later four-case comparison is referenced by the accounting history at $31.5670558 across 217 cumulative invocations; this record contains no score table for that run, so it supplies no further behavioral conclusion.

## Native delivery probe

On 2026-09-21, Claude Code 2.1.267 was tested against a loopback-only mock with a synthetic 16,255-byte SessionStart packet matching the frozen profile's size. The request contained its opening marker once, its closing marker zero times, and no complete copy. The CLI exited successfully and the unselected-configuration canary was absent.

This demonstrated incomplete delivery in that configuration. The evidence did not distinguish truncation from preview substitution. The delivery gate stopped the proposed paid ablation, leaving spend at $31.5670558 and 217 historical invocations. It cannot explain the earlier cast failure, whose evaluation supplied guidance directly and disabled native hooks.

Small-context selection and selected native-memory comparisons were subsequently proposed, but this record contains no completed outcomes for them. `guidance-ablation-v1`, `guidance-selected-v1`, and `--selection-of` are not supported public protocols. Current [skills evaluation](../architecture/09-evaluation.md#skills-environment-protocol) compares maintained skills without a profile overlay.
