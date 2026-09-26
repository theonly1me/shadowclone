# Guidance and memory evaluation

## Problem

The previous evaluation supplied a folder pointer instead of a usable skill catalog, did not isolate Claude memory from skills, and scored generic code conventions without testing learned knowledge. Its result cannot establish whether Shadowclone improves skill selection or replaces memory.

## Approved outcome

Add an opt-in `guidance-v1` protocol with four conditions: bare, skills, skills with Claude memory, and skills with Shadowclone. Use identical task requirements, repository snapshots, skill bodies, model, and effort. Keep historical transfer evaluation receipts unchanged.

The current round starts on 2026-09-20 at 09:43 UTC. Implementation and the pilot are authorized. Stop after the pilot for approval. The pilot ceiling is $5; a later approved full evaluation has a $50 cumulative ceiling. The entire round has a four-hour active-work limit and a 128-invocation ceiling, including retries and feedback. No commits, PRs, unrestricted learning, or continuous memory synchronization are authorized.

## Sequence

1. Record the existing dirty worktree, repository commit, and source fingerprints.
2. Correct skill catalog delivery, preserve mandatory skill steering, and freeze scoped references.
3. Audit the verified pre-migration Claude memory snapshot against current guidance. Repair only confirmed gaps in managed files through revision history.
4. Add a bounded protocol with source-backed cases, isolated conditions, successful-read traces, independent grading, and durable budgets.
5. Run focused tests and repository checks. Freeze four reviewed cases before any paid evaluation.
6. Run two pilot cases across four conditions, once each, with a $5 total ceiling. Report and stop.
7. Only after further approval, run four cases across four conditions with two repetitions and obtain one bounded Claude feedback audit. Report and stop.

## Interfaces and storage

`shadowclone eval --protocol guidance-v1` accepts a reviewed scenario file, an explicit memory source and migration manifest, model and effort, a maximum call count, deadline, and dollar budget. A frozen suite can be reused without reading changed live sources. A receipt resumes only missing work with its original limits.

The guidance protocol has its own versioned schema. Its frozen suite records source manifests, reference bodies, prompts, visible completion requirements, criterion provenance, and expected routing. Its receipt records the resolved model, successful reads, code or advice evidence, separate preference and knowledge scores, safety checks, unknown verification, judge disagreements, and spend.

Private suites and receipts remain under the existing local evaluation directories. No memory text, private source code, or detailed receipts are checked into this repository. Public summaries contain only aggregate results and limitations.

## Conditions

| Condition | Inputs |
| --- | --- |
| Bare | Task and repository-native guidance |
| Skills | Bare plus personal instructions and the native skill catalog |
| Claude memory | Skills plus the frozen Claude memory snapshot |
| Shadowclone | Skills plus the production bootstrap, profile, and scoped reference snapshot |

Skill bodies are identical in all skill-enabled conditions. Skills are read on demand. The profile contains concise steering and preferences, not copied workflows. Memory files are installed only in their selected condition. Ambient hooks, native memory, external MCP access, and the live profile are disabled or blocked.

## Validity

The scenario prompt includes every task-specific completion requirement. Preference and knowledge criteria cite frozen source evidence and remain withheld from execution. At most eight criteria apply to each case. Code correctness, safety, routing, preference adherence, and memory accuracy are reported separately. Advice cases do not require code edits. Unrun tests are unverified, never a failed test.

Successful tool results are joined to their requests before recording reads. Reports distinguish required-skill loading before editing from merely naming a skill or attempting a failed read. Exact syntax constraints use deterministic checks. Remaining criteria receive two blinded votes; unresolved disagreements stay unresolved unless a bounded adjudication succeeds.

The memory coverage ledger verifies backup hashes and destination content. A `covered` migration disposition is not proof of parity. Every actionable entry needs source-backed coverage, a documented exclusion, or a visible unresolved conflict. No live Claude memories are restored or removed.

## Acceptance

The pilot gate checks context delivery, isolation, evidence completeness, grading fixtures, model identity, and cost. It does not require a Shadowclone win. The full result compares preferences against bare and skills, shared-memory behavior against Claude memory, and examples of additional learned knowledge. A positive claim requires no safety violation and must disclose correctness regressions or incomplete evidence.

Freeze the cases and criteria before running. Do not tune them to observed results. Stop on unknown cost, exhausted budget, deadline, isolation failure, or the user-review gate. A negative or inconclusive result ends with a diagnosis, not an automatic retry loop.

## Initial pilot result

Implementation checks passed: 653 tests, typecheck, lint, and repository conventions. The real pilot resolved the requested Sonnet 5 model and produced one candidate, then stopped before its first grade because the Claude CLI rejected the new judge schema's Draft 2020-12 declaration. This is a harness compatibility bug, not evidence about Shadowclone quality. The rejected invocation supplied no cost receipt, so the durable budget marked cost unknown and refused further calls. No comparison completed and no full evaluation started.

The next bounded fix is to emit a Claude-compatible schema and add a local schema contract preflight before paid execution. Any continuation must preserve the frozen cases and original candidate evidence, explicitly reconcile the unknown-cost invocation, and retain the original cumulative pilot ceiling. Do not clear the budget ledger or create a replacement run to bypass it. Further paid execution requires user direction.

## Approved schema recovery

Recovery work starts on 2026-09-20 at 12:05 UTC with a 90-minute limit. Generate Draft 7 judge schemas and validate the installed Claude CLI against a loopback-only mock API using synthetic inputs and credentials. The legacy schema must fail before any messages request, and the corrected schema must reach the mock. No personal context enters these probes.

Explicit preflight recovery preserves the original receipt and budget in an audit record, verifies the failed CLI version against the contract proof, and reconciles only this local schema rejection. The legacy receipt did not record its CLI version, so recovery requires the version observed during that attempt. Preserve the original evaluation and frozen suite, candidate evidence, invocation count, and spend. One audited 25-minute renewal is allowed; repeated recovery cannot renew it again. Ordinary resume remains unchanged.

Run focused and repository checks, then resume judging the saved candidate. The cumulative limits remain $5 and 28 evaluation invocations. Report all eight responses and sixteen judge responses if completed, or the exact stopping condition. No full evaluation, learning, profile changes, commits, or PRs are included.

## Recovered pilot result

The recovered pilot completed at 12:32 UTC with eight candidates, sixteen judge responses, and 25 cumulative evaluation invocations. Recorded cost was $2.9722378, including the original candidate; the verified local schema rejection was reconciled as zero-cost with its original ledger preserved. The exact model was Sonnet 5 at medium effort. Frozen sources and the original candidate evidence remained unchanged. Verification passed 659 repository tests plus the separately enabled real-CLI contract test, typecheck, lint, and conventions.

Preference checks passed: Bare 2/5, Skills 5/5, Claude memory 5/5, Shadowclone 4/5. Shared-memory checks passed: Bare 3/4, Skills 3/4 with one unresolved judge disagreement, Claude memory 4/4, Shadowclone 4/4. Shadowclone's preference failure was a prohibited type assertion. There were no observed snapshot safety failures or syntax errors. Runtime correctness was not verified, and the additional-knowledge cases were outside this pilot.

Both memory-equipped conditions successfully read their two expected references. Some other read counts are unreliable: the tracker compares lexical paths and can drop valid canonical `/private/var` paths when the snapshot root uses `/var`. This was reproduced with a synthetic successful Read, without changing the running evaluation or spending on another model call. Missing reads and skill-loading timing cannot establish non-use. The pilot completed, but it does not demonstrate overall superiority or complete skill-routing validity. Work stops here; the full evaluation remains gated on user review.

## Approved measurement repair and validation

Implementation starts on 2026-09-20 at 13:16 UTC and stops by 16:16 UTC. Repair canonical-path read accounting and replace inferred Bash writes with successful mutation events and explicit unknown timing. Preserve request and result ordering and persist only normalized tool metadata, never command bodies or tool outputs. Historical measurements remain unchanged and are labelled unreliable.

Freeze four judge-only evidence files, named in the private scenario, from the original repository commit. Materialize those explicit files through the redaction boundary, with hashes and line numbers, under a 64 KiB packet cap. Every advice judge receives identical evidence. Missing corroboration is not proof of fabrication. Candidate prompts, criteria, profiles, skills, and memory inputs remain frozen.

Verify regression tests against the unfixed behavior, then run focused checks, typecheck, lint, repository tests, and a real Claude CLI stream contract against a loopback-only mock. Only after those pass, run one linked validation of the existing two pilot cases across four conditions twice: sixteen candidates and thirty-two judges, using Sonnet 5 at medium effort.

The cumulative ceiling is $10 including $2.9722378 already recorded. The child ledger allows at most $7.0277622 and 48 new evaluation invocations, for 73 cumulative. Validation mode resumes its one linked receipt without resetting spend or deadlines. Its paid window is 45 minutes and cannot renew. Stop on unknown cost, exhausted limits, missing evidence, model mismatch, or isolation failure. Report outcomes and exact artifacts, then stop. No profile changes, skill edits, learning, commits, PRs, feedback audit, or $50 run are included.

## Measurement validation result

Validation completed on 2026-09-20 at 14:05 UTC with all sixteen candidates and thirty-two judge responses. It used 48 new evaluation invocations and $6.5293998 of reported cost, for 73 invocations and $9.5016376 cumulative. The exact model was Sonnet 5 at medium effort. No cost remained pending or unknown. The original suite, receipt, and budget remained unchanged, and the real repository stayed clean. Verification passed 673 repository tests, both separately enabled installed-CLI contracts, typecheck, lint, and conventions.

Preferences: Bare 4/10, Skills 9/10, Claude memory 10/10, Shadowclone 9/10. Shared memory: Bare 6/8, Skills 7/8, Claude memory seven passes and one unresolved, Shadowclone six passes, one failure, and one unresolved. All skill-enabled coding responses successfully read the required skill. Four of six had explicitly unknown edit timing. Both memory-equipped conditions read both expected references in both advice repetitions.

The tracking repairs passed, but the final source audit identified a remaining judging limitation: short criterion quotations omit historical verification recorded in the full memory source, and a judge treated that attribution as a new execution claim. Judges also differ on answers that combine one valid command with an incorrect directory in an alternative. A shared reference contains an incorrect repository path. Those are findings for a separately approved decision, not additional work in this round. Recorded votes remain unchanged, and the $50 evaluation is not yet recommended. No profile or learning changes were made. Work stops after the report.

## Approved maintained-reference comparison

Implementation starts on 2026-09-20 at 17:07 UTC. Finish offline verification by 19:07 UTC or do not start paid execution. Report and stop by 20:07 UTC. Correct only one managed reference's repository path through locked revision history, against the frozen repository commit. Preserve its original source provenance and every other guidance input. Claude memory stays the historical baseline. This measures explicitly directed maintenance, not equal-fact delivery or autonomous repair.

Judge version 3 includes the two complete historical memory bodies alongside the four existing repository documents and exact path-existence evidence. Use neutral source identifiers, hashes, and line numbers, with the source mapping retained only in the private receipt. Every advice judge receives the same packet, limited to 64 KiB. Supported historical execution attributed to its source is permitted; invented current-session execution is not. Every recommended runnable alternative must be valid, so one correct command does not excuse an incorrect alternative. Preserve all other criteria and candidate prompts.

Add an explicit maintenance evaluation linked to the completed measurement validation and a new frozen suite. Its one stable child retains the historical accounting baseline, exact source delta, revision identity, model, and immutable deadline. The maximum is $10 additional and 48 new invocations, giving $19.5016376 and 121 cumulative. Ordinary evaluation and the previous validation remain unchanged. Resume never grants a new allowance or repeats saved evidence.

Verify the reference revision, source boundary, judge packet, frozen-input allowlist, historical compatibility, accounting, and interrupted resume. Prove regressions fail without their fixes. Run repository checks and both installed-Claude loopback-only contracts before real model use. Then run the same two cases across Bare, Skills, Skills plus Claude memory, and Skills plus Shadowclone twice: sixteen candidates and thirty-two judges using exactly claude-sonnet-5 at medium effort, within one 45-minute window.

Stop on uncertain cost, limits, deadline, model mismatch, isolation failure, or incomplete evidence. No retries, adjudication, learning, profile regeneration, skill edits, commits, PRs, or feedback audit. A promising result requires Shadowclone to match or exceed both skill-enabled baselines in preferences and shared memory, resolved relevant judgments, and no task-boundary or safety violations. Report the unchanged scores, maintenance provenance, reads, limitations, cost, and artifact paths once, then stop regardless of outcome.

## Maintained-reference comparison result

The run completed on 2026-09-20 at 17:58 UTC with sixteen candidates, thirty-two judge responses, and exactly 48 new evaluation invocations using claude-sonnet-5 at medium effort. The paid window started at 17:27 UTC and retained its 18:12 UTC deadline. New reported cost was $7.2567122, for $16.7583498 and 121 invocations cumulative. No cost remains pending or unknown. Implementation verification passed 683 repository tests, both separately enabled installed-CLI contracts, typecheck, lint, and conventions.

Preferences: Bare 6/10, Skills 9/10, Skills + Claude memory 10/10, Skills + Shadowclone 9/10. Shared memory: Bare five passes, two failures, and one unresolved out of eight; Skills 6/8; Skills + Claude memory 6/8; Skills + Shadowclone 8/8. Both Shadowclone advice repetitions used the corrected path. Supported historical verification was accepted by both judges. The only unresolved judgment concerns Bare's alternative fix. Scores describe adherence to frozen guidance, not verified execution of command alternatives; some judge explanations still overstate their functional invalidity.

The overall verdict is below target. Shadowclone's second coding response used a prohibited assertion and edited existing package exports outside the task boundary. Skills also failed type safety in its second repetition. All six skill-enabled coding responses successfully read clean-code but have unknown edit timing. Both memory-equipped conditions read both expected references in both advice repetitions. All snapshot safety checks passed; runtime correctness remains unverified.

The repair changed exactly one managed reference through revision history. The original profile, skills, Claude memory baseline, and historical artifacts remain unchanged. This was explicitly directed maintenance on reused diagnostic cases, not proof of autonomous repair, comprehensive memory parity, or additional-learning value. Do not move to the $50 evaluation yet. Report and stop.

## Approved offline judging clarification

Work starts on 2026-09-20 at 18:53 UTC and stops by 19:38 UTC. The confirmed problem is that a judge can explain a failure to follow a required workflow as proof that a documented command cannot run. This round changes the judge contract, not the frozen criteria or candidate inputs. No paid evaluation, learning, profile maintenance, skill edits, commits, or PRs are included.

Introduce source judge version 4 for newly initialized source-grounded comparisons. Separate adherence to the explicit source-backed requirement from technical validity. A documented alternative is not automatically compliant with an explicitly required workflow, and a workflow mismatch is not proof of runtime failure. Unsupported invalidity claims stay unverified. Grade exact mock-export requirements independently of whether a different technique might avoid recursion. Preserve historical attribution, path-existence evidence, the mixed-command policy, deterministic type checks, and the task-boundary gate.

Keep versions 2 and 3 byte-stable, with their original fingerprints and resume behavior. Persist the new version and fingerprint on new receipts. Preserve completed candidates, votes, source packets, spend, and deadlines on resume. Do not regrade the completed comparison or create a new allowance. Existing ordinary evaluations and validation remain unchanged.

Add offline contract fixtures for documented command alternatives, explicit workflow requirements, alternative mock strategies, invalid directories, mixed alternatives, historical attribution, and insufficient evidence. Verify version selection through the runner, identical delivery across conditions, historical receipt compatibility, and rejection of changed fingerprints. Prove new regression tests fail when the corresponding wiring is removed. Run focused tests and touched-file lint; report any broader checks that were not run. Offline fixtures establish delivery and contract wiring, not model reasoning accuracy.

After verification, report the change and stop. A future paid comparison needs separately agreed cases, invocation and time limits, and a dollar ceiling. It should include the previously unused skill-routing and additional-knowledge cases with frozen inputs and the same four conditions. Do not tune guidance or repeat the diagnostic cases until scores improve.

## Offline judging clarification result

Version 4 is implemented for newly initialized source-grounded comparisons. Versions 2 and 3 retain their original prompt fingerprints. Synthetic resume tests exercised both source-judge versions, preserved saved candidates and votes, completed exactly 48 simulated invocations per fixture, and retained each fixture's spend and deadline. The completed real maintenance receipt, report, and budget retain their original byte hashes and remain version 3. No historical result was regraded.

Verification passed 54 guidance tests with zero failures. The two installed-Claude contract tests were skipped; they were not rerun in this round. Touched-file lint passed for ten TypeScript files, the convention scan passed for 862 files, and git diff --check passed. Four inverse mutations produced the expected regression failures: missing clarification delivery, missing version 4 runner dispatch, new receipts incorrectly initialized with version 3, and a missing prompt-fingerprint guard. All fixes were restored before the passing guidance test run. Full repository tests and typecheck were not rerun.

No paid model calls or new evaluation receipts were created. New evaluation spend is zero; the previously reported cumulative spend remains $16.7583498 across 121 invocations. Profiles, skills, reference bodies, candidate inputs, grading criteria, and historical packets are unchanged. Source material still uses the existing materializeSnapshot boundary; this change adds no capture source, raw logging, or network destination. Offline tests prove contract wiring and preservation, not the next model judge's reasoning. Stop after this report; a further paid run needs an approved scope and cap.

## Approved four-case comparison

Work starts on 2026-09-20 at 20:14 UTC. Finish implementation and offline preflight by 21:14 UTC or do not start paid execution. Use one 90-minute paid window and report by 23:00 UTC. The approved run contains all four existing frozen cases twice across Bare, Skills, Skills + Claude memory, and Skills + Shadowclone: 32 candidates and 64 independent judge responses, at most 96 new evaluation invocations. Use exactly claude-sonnet-5 at medium effort. The additional spending ceiling is $20, giving $36.7583498 and 217 invocations cumulative.

Add --comparison-of <completed-maintenance-id> with --additional-budget-usd 20. Verify the completed maintenance receipt, its frozen suite, and the original pilot and validation accounting chain. Derive one stable child identity from that parent and the comparison protocol. Repeated invocation resumes the same child, with the same budget, call limit, frozen sources, judge version 4, and original deadline. Changed inputs or limits are rejected. Reuse the frozen source packet and provenance from the parent; no new source capture or profile regeneration is needed. Existing maintenance, validation, and ordinary resume semantics remain unchanged.

Before spending, verify accounting without double-counting, version 4 prompt delivery, all-case selection, saved-candidate and saved-vote resume, unknown cost, exhausted limits, changed sources, and exact model matching. Run focused regression tests with inverse mutations, typecheck, lint, conventions, the repository suite, and both installed-Claude loopback-only synthetic contracts. Freeze the implementation after preflight. The paid window starts only after initialization preflight and cannot renew.

Persist every candidate and individual vote. Stop on unresolved cost, limits, expiry, model mismatch, isolation failure, or incomplete source evidence. No retries, extra adjudication, guidance changes, learning, commits, PRs, or separate feedback audit are included. Keep disagreements unresolved and tests not executed explicitly unverified. Report preference, shared-memory, and additional-knowledge scores by condition and repetition, routing and reference reads, task violations, new and cumulative spending and calls, judge provenance, and artifact paths. Two cases are reused diagnostics; the other two have not previously been run. This comparison retains the explicitly maintained-reference advantage and does not establish comprehensive memory parity. Report the result once and stop regardless of outcome.

## Approved sandbox delivery ablation

Implementation starts on 2026-09-21 at 09:26:53 UTC. Finish implementation and offline verification by 11:26:53 UTC or stop without paid calls. Use at most 45 minutes of paid execution and reserve 15 minutes for reporting. Stop all work by 12:26:53 UTC. The additional ceiling is $10 and 48 evaluation invocations, giving $41.5670558 and 265 cumulative. Use exactly claude-sonnet-5 at medium effort. No retries, adjudication, deadline renewal, live rollout, learning, profile regeneration, skill changes, commits, or PRs.

Reuse the completed four-case comparison's frozen suite, but run only the two diagnostic cases, twice each. Compare Skills, the full profile through SessionStart, task-selected guidance through SessionStart, and the identical selected packet through native Claude memory. Skills stay identical. This is sixteen candidates and thirty-two independent judge responses. Selection runs before the CLI starts and has no access to scenario IDs, criteria, expected references, or generated answers. It uses local term ranking, a fixed stopword list, at least two distinct matching terms, at most four whole items, and a 4 KiB packet. No match falls back to skill routing alone.

Prove native delivery early with the installed CLI against a loopback-only synthetic mock. Verify single complete delivery, ordering, isolated settings, denied memory writes, and no personal-context leakage. Include a synthetic packet matching the frozen full profile's byte size. A missing, duplicate, truncated, or preview-substituted condition is a preflight failure and ends this round without paid calls. Do not replace a failed delivery mechanism or weaken isolation. This gate precedes implementing the paid runner when it can identify an incompatible CLI contract sooner.

If native contracts pass, add guidance-ablation-v1 with one stable child of the completed comparison, independent receipt versioning, unchanged historical schemas, and resumable accounting that preserves every saved candidate, vote, and deadline. Freeze all selection and source fingerprints before spending. Retain judge version 4 and append only neutral frozen-commit existence facts for the previously misjudged repository locations to the new packet. Keep packet size under 64 KiB. Report task-boundary violations separately from preference scores and leave candidate runtime correctness unverified.

Run regression tests with demonstrated inverse mutations, focused tests, typecheck, lint, conventions, the repository suite, and the existing installed-CLI schema and stream contracts before spending. Preserve existing WIP and historical receipts. Record delivery proofs and exact artifact paths. Report per-condition and per-repetition scores, disagreements, casts, task violations, skill/reference reads, unknown timing, selected and omitted guidance, actual model, costs, and calls. A selected variant is promising only if it matches Skills preferences and full-profile shared memory without task-boundary or isolation failures or relevant unresolved judgments. Otherwise report below target or inconclusive. Report once and stop.

## Sandbox delivery ablation preflight result

The early native gate failed on 2026-09-21 at 09:30:59 UTC with Claude Code 2.1.267. A loopback-only mock received one synthetic messages request. Its SessionStart packet matched the frozen profile's 16,255-byte size. The request contained the opening marker once, the closing marker zero times, and zero complete copies. The CLI exited successfully. The unselected-configuration canary was absent. This establishes incomplete delivery in the tested configuration; the recorded metadata does not distinguish truncation from preview substitution.

Follow the approved failure boundary: no paid evaluation starts and implementation does not expand beyond the native probe and completeness regression test. The task selector, native-memory verification, linked paid CLI, and revised judge packet remain unimplemented. This does not explain the earlier cast failure, because that evaluation injected guidance directly into the prompt and disabled native hooks. No variant scores or preference improvement can be claimed from this preflight.

Verification passed 701 tests with two installed-CLI contracts skipped, typecheck, lint, conventions, and git diff --check. The new completeness regression failed when reduced to an opening-marker-only check and passed when restored. No additional real model calls were made: spending remains $31.5670558 across 217 historical invocations. Preserve the proof, accounting summary, source manifest, and report under the private evaluation artifact. Report this inconclusive comparison and stop; no workaround or additional run is authorized in this round.

## Approved small-context delivery investigation

Work starts on 2026-09-21 at 12:12:06 UTC and stops by 13:12:06 UTC. Both 4 KiB native delivery mechanisms must pass by 12:32:06 UTC or implementation stops. This round permits at most twelve synthetic CLI invocations of at most 45 seconds each against an isolated loopback mock, with zero real-model calls and zero spending. Preserve all historical artifacts and live guidance. No paid runner, upgrades, learning, regeneration, commits, PRs, or rollout are included.

Diagnose the previous full-profile failure with complete-packet checking, character and byte boundary fixtures, and canonical temporary-file inspection. Record only hashes, lengths, marker counts, positions, classifications, and normalized tool outcomes. Test native hook and native memory with identical 4 KiB packets, isolated settings, absent configuration canaries, successful reference reads, and denied Write, Edit, and shell memory modifications. A preview is not complete inline delivery. Do not bypass the full-profile limit.

After the delivery gate passes, implement an opt-in pure selector over frozen guidance, with fixed stopwords, at least two distinct matching terms, stable ties, and at most four whole items within 4 KiB and 200 lines. Preserve skill catalog routing, exclude duplicate routing blocks, and never fall back to the full profile. Produce diagnostic selection manifests without grading inputs or model calls. Verify regressions, unchanged default compilation, historical parsing, typecheck, lint, conventions, and the repository suite within the remaining time. Write a new report linked to the preflight artifact, report limitations and paid-comparison readiness, and stop.

## Approved selected native-memory comparison

Work starts on 2026-09-21 at 18:03:41 UTC and stops by 21:03:41 UTC. Complete implementation within 75 minutes and offline verification by 20:03:41 UTC or do not spend. Reserve one 45-minute paid window and fifteen minutes for reporting. The additional ceiling is $10 and 48 evaluation invocations using exactly claude-sonnet-5 at medium effort. Verify the historical accounting baseline of $31.5670558 and 217 invocations. No retries, adjudication, answer regeneration, deadline extensions, learning, live guidance changes, CLI upgrades, commits, PRs, or rollout are included.

The confirmed selector bug is that common lexical matches admit unrelated guidance for an identifier task. Before changing ranking, freeze twelve labeled offline fixtures: six engineering queries with an intended item and six unrelated queries. Selector version 2 retains exact token matching and the fixed stopwords, requires two matching terms and a rare title/tag/applicability anchor, and scores distinct terms using IDF with field weights 4/4/3/2/1. Scope and repository identity are not applicability anchors. Preserve four whole items, 4 KiB, 200 lines, duplicate exclusion, reference retrieval, and no-match abstention. Do not tune using paid cases or scores.

Reuse the completed comparison and its frozen repository and guidance. Compare Skills, Skills plus native Claude memory, Skills plus selected Shadowclone SessionStart hook, and Skills plus the identical selected Shadowclone native-memory packet. Use the two diagnostic cases twice: sixteen candidates and thirty-two judges. Native Claude memory replaces the old prompt-delivered baseline. Exclude the unsupported full-profile hook condition. Preserve common skill delivery, tools, isolation, candidate instructions, and deterministic condition rotation.

Add guidance-selected-v1 with --selection-of and --additional-budget-usd, a separate receipt schema, stable parent-derived identity, immutable inputs, and resumable candidates, votes, costs, calls, and deadline. Native candidates use isolated settings and read-only guidance without exposing personal context or copying credentials. Stop if safe authentication cannot be preserved. Keep ordinary evaluations and live integrations unchanged. Retain judge version 4 and criteria, adding two neutral frozen package manifest sources and existence facts through the existing redaction boundary, identically for every advice judge, within 64 KiB. Do not regrade history.

Before paid execution, run focused tests, typecheck, lint, conventions, the full suite, critical inverse regressions, and at most twelve 45-second loopback-only synthetic CLI invocations. Verify both small delivery channels and the native historical index shape of 14,403 bytes and 63 lines, denied memory writes, successful reference reads, absent canaries, immutable hashes, schema/stream handling, and persistence. Freeze diagnostic selections only after offline acceptance. Stop on unknown cost, model mismatch, missing evidence, isolation failure, limits, or deadline. Report scores, unresolved judgments, violations, reads and timing, provenance, cost, calls, and artifact paths once, then stop. Synthetic delivery is not proof of adherence; reused cases do not establish broad memory parity or superiority.
