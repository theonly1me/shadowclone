# Running the preference evaluation

This contributor benchmark measures how well learning keeps your rules and how well agents receive them. The [results](../../evals.md) compare five setups on four models. The protocol identifier is `preference-respect-v3`. Review, routing preparation, and offline validation make no authenticated calls.

Use the source checkout and its pinned Bun version. The packaged release does not contain the benchmark fixtures. Every output path below is a new private directory outside every repository.

## Fixed contract

| Setup                                     | Guidance                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Agent alone                               | Shared repository requirements                                              |
| Existing user skills                      | Unchanged handwritten code-style skill                                      |
| Existing skills + Shadowclone routing     | The same library with production initialization and native startup guidance |
| Existing skills + handwritten preferences | The routed library plus independently handwritten intended learned guidance |
| Existing skills + Shadowclone learning    | The routed library plus the actual learning output                          |

The handwritten reference and the learned guidance use the same delivery path. Neither one adds answers to the task prompts. Saved receipts call them `told` and `deep`. The difference between them measures how closely learning follows the intended guidance. The difference between learning and routing measures the effect of learning. Neither one alone proves production throughput.

These authored inputs are separate from each other:

- [Public cases](../../evals/fixed/reusable/cases/)
- [Target specification](../../evals/fixed/reusable/oracle.ts)
- [Manual guidance](../../evals/fixed/reusable/guidance.ts)
- [Correction corpus](../../evals/fixed/reusable/corpus.ts)

The corpus has repeated examples, conditional defaults, a one-task waiver, the replacement of an older instruction, and insufficient evidence. Tool-result decoys must not enter eligible learning text.

Each run builds fresh disposable homes and repositories from these synthetic fixtures through the standard CLI. Credentials, held-out content, learned environments, and execution evidence stay in private storage.

Each of the eight families has 2 development cases and 1 held-out case. Each family has a headline weight of 12.5%. The families are comments, types, API conventions, Git authorization, answer length, test-first behavior, pull request structure, and scope and lifecycle.

The eight held-out cases live in a private bundle outside every checkout. Only their [hashes and family coverage](../../evals/fixed/reusable/heldout-manifest.json) are public.

Keep the bundle in durable private storage and back it up on its own, because hashes cannot rebuild it. Do not give it to an optimizer. Human reviewers inspect its case and verdict specification before the freeze. Candidates read its prompts only during qualification. Development uses the sixteen public cases.

A separate [routing experiment](../../evals/fixed/reusable/routing.ts) compares the same 20 manual skills with and without routing on twelve public cases. Skill descriptions overlap, and task module names match skill names.

The contrast adds generic startup guidance, so it does not isolate explicit production skill routes. Selection needs the relevant skill read and no unrelated library reads. Compliance checks the generated code on its own. A selection pass never turns a compliance failure into a pass. This experiment does not measure learning and uses no learning calls.

## Review and offline preparation

Read the private review artifact first. It lists the expected verdict, check kinds, and calibration fingerprint of each case. Approval is an explicit decision on the shown fingerprint.

```bash
bun run eval --protocol preference-respect-v3 --phase review \
  --bundle-file "$PRIVATE_ROOT/heldout/bundle.json" \
  --review-file "$PRIVATE_ROOT/review.json"

bun run eval --protocol preference-respect-v3 --phase approve-review \
  --review-file "$PRIVATE_ROOT/review.json" --fingerprint "$REVIEW_FINGERPRINT"

bun run eval --protocol preference-respect-v3 --phase prepare-environments \
  --bundle-file "$PRIVATE_ROOT/heldout/bundle.json" \
  --review-file "$PRIVATE_ROOT/review.json" \
  --model "$LEARNER_MODEL" --effort medium --maximum-calls 16 \
  --output-directory "$PRIVATE_ROOT/environments"
```

Preparation pins one Codex learner, its CLI version, model, effort, source snapshot (with untracked files), runtime, graders, corpus, and manual guidance.

Three independent learning homes start with the same routed guidance. Preparation captures both agents and both synthetic repositories. Git metadata is on only for those synthetic repositories, and their prep remotes are identity fixtures that nothing contacts. Background work is off.

Offline routing and the told setup keep manual bytes exactly. Authorized learning can update a description and append published guidance. It must keep the skill name, other metadata, file mode, and every original manual instruction. A replaced or removed manual text blocks qualification.

The corpus has fixed synthetic observations that bind each correction session to a synthetic repository at its original time. Preparation replays them through the production index API and checks their scope.

A read-only check repeats before any learner call. All 22 assistant examples and user corrections must survive the native adapter and redacted materialization.

That keeps 11 paired steering episodes and excludes the tool-output decoy. Unknown historical sessions stay isolated. A missing binding, missing context, changed remote, or disabled Git-metadata consent stops preparation. The CLI prints the scope-check summary and saves `learning-source.json`.

Review approval does not authorize model execution. Each preparation allows at most sixteen calls, a two-minute call timeout, and a twenty-minute deadline. The full learning ceiling is 48 calls. A lower cap for each preparation gives a lower approved ceiling.

The production learning execution and its native runner both receive the frozen deadline. Ordinary CLI learning keeps its own limits. If one preparation is incomplete, later preparations do not start, and no qualification environment appears. Private diagnostics for each call survive cleanup.

## Bounded development preflight

Before you pay for learner preparations, prepare `--experiment learning --run-phase preflight` from `preparation.json` without an environments file. This run uses all sixteen public cases, the bare and told setups only, and one repetition. That is 32 planned calls plus 32 reserved infrastructure replacements for each scored model. Approve this scope on its own.

The preflight uses no learning calls and no held-out prompts. It reports baseline saturation, unmet told checks, and execution gaps, with no confidence intervals. Do not drop checks in response. It qualifies scorer behavior and possible headroom. It is not the final performance run.

## Separately authorized learning

After you approve the pinned learner and the full ceiling, create the exact scope and run it:

```bash
bun run eval --protocol preference-respect-v3 --phase approve-learning \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --fingerprint "$PREPARATION_FINGERPRINT"

bun run eval --protocol preference-respect-v3 --phase learn \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --scope-file "$PRIVATE_ROOT/environments/learning-scope.json" --yes
```

Production ingestion, `resolveRedacted`, extraction, reconciliation, and publication process only eligible synthetic instructions. Learner sandboxes have no tools or memory. They deny access to the checkout, the oracle, the held-out bundle, and the preparation storage.

Each independent preparation has its own budget ledger and call records. The run keeps published text, pending proposals, absent expected rules, and suspected unsupported guidance. The first check of semantic coverage is heuristic. Missing or pending guidance is a learning outcome. Never substitute the told answers for it.

Inspect the three outputs against the independent target and the negative evidence. Then follow these steps:

1. Copy the `learning-assessment-draft.json` that the run emitted.
2. Keep its preparation and published-text fingerprints.
3. Record the missing rule ids and the unsupported published keys, with reasons.
4. Set its decision to `reviewed`.
5. Record it with `--phase review-learning --environments-file ... --assessment-file ...`.

This assessment uses no model and changes diagnostic verdicts only. Published guidance and pending proposals stay as they are. Qualification needs all three assessments. The development preflight can run with the first heuristic diagnostics, labeled `review-required`.

An interrupted preparation cannot get a new budget or run again without approval. Completed preparations stay. A model failure or an infrastructure failure makes a preparation incomplete and blocks qualification. Keep the evidence and approve a fresh cohort if you need another preparation.

Run learning once for each unchanged preparation set. Then reuse its `environments.json` for every scored model. Resuming a candidate suite makes no learning call. The bare and told preflight and the routing experiment need no learning.

For a new cohort after a change to the evaluator or the documentation, build fresh environments with `prepare-environments`. Then reuse the completed source:

```bash
bun run eval --protocol preference-respect-v3 --phase reuse-learning \
  --source-file "$PRIVATE_ROOT/original-environments/learning-source.json" \
  --preparation-file "$PRIVATE_ROOT/new-environments/preparation.json"
```

Reuse needs a match on these items:

- The sealed production learning code, the fixture setup, and the correction corpus.
- The runtime inputs, the initial guidance, the learner model, the effort, and the CLI.
- All completed call ledgers.

Reuse records the original provenance in the new cohort and makes no model call. Review the kept outputs with `review-learning` before qualification. A change to the learning code or inputs needs a fresh, separately authorized preparation. Reuse never adds missing guidance or changes pending outcomes.

## Freeze each cohort

Use the same three preparation outputs for every scored agent and model. Deep repetition one uses preparation one, and so on. A change of agent or model needs its own qualification, even if the product is the same.

```bash
bun run eval --protocol preference-respect-v3 --phase prepare \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --environments-file "$PRIVATE_ROOT/environments/environments.json" \
  --experiment learning --run-phase development \
  --engine codex --model "$SCORED_MODEL" --effort medium \
  --output-directory "$PRIVATE_ROOT/development"
```

Use `--engine claude-code` for Claude. Choose `--run-phase qualification` only after the separately budgeted preflight and the case review. The optional full `development` run compares five setups on the sixteen public cases.

Qualification keeps all 24 cases, including saturated or ambiguous checks, and never drops a case because of results. For the routing experiment, use `--experiment routing`, omit `--environments-file`, and use a new output directory.

| Experiment             | Sessions per model | Planned turns | Reserved retry turns | Candidate ceiling | Shared preparation ceiling |
| ---------------------- | -----------------: | ------------: | -------------------: | ----------------: | -------------------------: |
| Bare/told preflight    |                 32 |            32 |                   32 |                64 |                          0 |
| Learning development   |                240 |           240 |                  240 |               480 |                         48 |
| Learning qualification |                360 |           360 |                  360 |               720 |                         48 |
| Routing                |                 72 |            72 |                   72 |               144 |                          0 |

A shared cohort pays the preparation ceiling once, not once for each scored agent. Qualification plus routing across four models has a ceiling of 3,504 calls, including shared preparation. Most runs use fewer calls, because the ceiling includes one full replacement for each cell. Subscription costs that the CLIs do not report stay unknown. No earlier approval covers these calls.

## Validate, approve, run, and report

```bash
bun run eval --protocol preference-respect-v3 --phase validate \
  --suite-file "$PRIVATE_ROOT/development/suite.json"
```

Validation checks passing and failing grader outputs, boundaries and overrides, acceptance failures in the initial implementation, and passing reference implementations.

It also runs a real read-only mount and a sandbox answer-access probe, with no authenticated call. Codex cohorts also test the native CLI permission profile with writable and read-only workspaces, with memory on and off.

Shared temporary reads and writes, grading-answer access, and guidance edits must fail. The disposable workspace and the private temporary directory must stay usable. Run the native macOS sandbox checks outside any enclosing agent sandbox. A failed validation blocks the run. These checks do not qualify the Claude sandbox.

After you approve the agent, model, effort, phase, and printed invocation ceiling, run these commands:

```bash
bun run eval --protocol preference-respect-v3 --phase approve-run \
  --suite-file "$PRIVATE_ROOT/development/suite.json" --fingerprint "$SUITE_FINGERPRINT"

bun run eval --protocol preference-respect-v3 --phase run \
  --suite-file "$PRIVATE_ROOT/development/suite.json" \
  --scope-file "$PRIVATE_ROOT/development/run-scope.json" --yes

bun run eval --protocol preference-respect-v3 --phase report \
  --suite-file "$PRIVATE_ROOT/development/suite.json"
```

The run is serial. It saves ownership before dispatch and reserves every native invocation before it starts. A resume checks the fingerprints again and keeps completed, unfavorable, and interrupted cells.

Before you remove the private `.running` lock of an interrupted process, confirm that the process ended. Keep its ledger. Interrupted cells and timed-out cells with no clear class do not run again on their own.

Reports read the budget ledger through a bounded, schema-checked reader. Suites and receipts have their own fingerprints. A report charges every reservation from the durable ledger, even when an interruption stopped the attempt record. An unattributed reservation or a pending dispatch leaves the run incomplete. You cannot remove them by rebuilding spend from completed sessions.

One confirmed infrastructure failure allows one replacement in a fresh workspace. Both attempts stay in the receipt and count toward the ceiling. Known mount-command and acceptance-sandbox startup failures have stage diagnostics. A clear provider quota refusal before any agent action creates `provider-pause.json` and stops dispatch.

Keep that file, wait for the stated reset, then remove the pause marker and its sidecar to resume under the same scope. Other provider failures and timeouts with no confirmed class stay unresolved. A cleanup retry never erases a preference, correctness, or safety failure that you observed. Mount, execution, verification, cleanup, and raw native transport stay private.

An unresolved setup, mount, verification, or cleanup failure creates `infrastructure-hold.json`. It stops further dispatch after any permitted replacement. A resume respects the hold. Read its private evidence before you remove the marker and its sidecar. An ordinary model failure is a recorded outcome and does not authorize a replacement call.

All remote actions use a local bare Git origin and recorded offline `gh` calls. Candidates cannot read their grading answers, change protected manual guidance, or contact real repository remotes. Each host needs its own native sandbox qualification, because advisory instructions do not enforce these limits.

## Scores and comparison

In a session, the score is the share of required preference checks that pass. Average complete repetitions and cases inside each family, then average the eight family scores.

Answer length counts for at most 12.5%. It counts all whitespace-separated tokens in the final answer, including code and fences. The default allows eighty tokens inclusive. The 250-word override accepts 220 through 280 inclusive.

Correctness, safety, unsupported learning, selection, and execution completion have separate fields. If required evidence is missing, the headline stays incomplete and its denominator keeps its size. Unknown checks stay unknown. Reports keep the preparation identities and every attempt.

The primary 95% intervals list the bootstrap resamples of the three whole repetition and preparation groups, with the task mix fixed. Matched setups share the same resample. The intervals do not resample single checks or families. Three groups give coarse intervals. Cohorts that use the same preparations correlate, so do not pool them as independent samples.

For matched product branches, run `--phase compare --baseline-file ... --candidate-file ...` with suite files. Cases, original guidance and correction inputs, learner configuration, agent versions, models, efforts, runtime, and budgets must match.

The prepared outputs can differ because of the product change, and the report shows both sets. Reuse this benchmark version for product changes. Change the version when the contract changes in a meaningful way, and keep the older records.

## Relation to the Claude.dev article

This benchmark follows [Automating eval design and hillclimbing with Claude](https://claude.dev/blog/automating-eval-design-and-hillclimbing/). It uses fixed inputs, explicit scoring, grader calibration, separate development and held-out data, repeatable comparisons, and kept execution failures.

It does not use the plugins of the article, and it has no autonomous optimizer. Offline tests cannot establish model headroom, effort scaling, production representativeness, or independent expert agreement.

Before you publish qualification results, run an independently budgeted development preflight when the selected agents are available. Inspect ambiguous verdicts and report saturation without removing checks.

Keep held-out prompts and answers sealed from candidate optimization. Publish all setup and family scores, preparation outcomes, limits, execution gaps, and the phase that you used. The [results](../../evals.md) keep the completed comparison and its limits.
