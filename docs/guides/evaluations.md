# Running the preference evaluation

This contributor benchmark measures learning fidelity and guidance delivery. The [completed results](../../evals.md) compare five setups on four models. The internal protocol identifier is `preference-respect-v3`. Review, routing preparation, and offline validation make no authenticated calls.

## Fixed contract

| Setup                                     | Guidance                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Agent alone                               | Shared repository requirements                                              |
| Existing user skills                      | Unchanged handwritten code-style skill                                      |
| Existing skills + Shadowclone routing     | The same library with production initialization and native startup guidance |
| Existing skills + handwritten preferences | The routed library plus independently handwritten intended learned guidance |
| Existing skills + Shadowclone learning    | The routed library plus actual learning output                              |

The handwritten reference and learned guidance use the same delivery path. Neither receives answers appended to task prompts. Saved receipts call them `told` and `deep`. Their difference measures fidelity to intended guidance. Comparing learned guidance with routing measures the effect of learning. Neither comparison alone proves production throughput.

The [public cases](../../src/eval/fixed/reusable/cases/), [target specification](../../src/eval/fixed/reusable/oracle.ts), [manual guidance](../../src/eval/fixed/reusable/guidance.ts), and [correction corpus](../../src/eval/fixed/reusable/corpus.ts) are authored separately. Corrections include repeated examples, conditional defaults, a one-task waiver, replacement of an older instruction, and insufficient evidence. Tool-result decoys must not enter eligible learning text.

These synthetic fixtures are versioned source inputs. Each run materializes them into fresh disposable homes and repositories through the standard CLI. No custom sessions or handwritten setup scripts are needed. Credentials, held-out content, learned environments, and execution evidence remain in private storage.

| Family              | Development cases | Held-out cases | Headline weight |
| ------------------- | ----------------: | -------------: | --------------: |
| Comments            |                 2 |              1 |           12.5% |
| Types               |                 2 |              1 |           12.5% |
| API conventions     |                 2 |              1 |           12.5% |
| Git authorization   |                 2 |              1 |           12.5% |
| Answer length       |                 2 |              1 |           12.5% |
| Test-first behavior |                 2 |              1 |           12.5% |
| PR structure        |                 2 |              1 |           12.5% |
| Scope and lifecycle |                 2 |              1 |           12.5% |

Eight held-out cases live in a private bundle outside every checkout. Only their [hashes and family coverage](../../src/eval/fixed/reusable/heldout-manifest.json) are public. Store the bundle in durable private storage and back it up independently; it cannot be reconstructed from hashes. Do not give it to an optimizer. Human reviewers inspect its case-and-verdict specification before freezing; candidates access its prompts only during qualification. Development uses the sixteen public cases.

A separate [routing experiment](../../src/eval/fixed/reusable/routing.ts) compares the same 20 manual skills with and without routing on twelve public cases. Descriptions overlap, while task module names match the corresponding skill names. The completed contrast adds generic startup guidance, so it does not isolate explicit production skill routes. Selection requires reading the relevant skill without unrelated library reads. Compliance independently checks the generated implementation. Selection passes never turn a compliance failure into a pass. This experiment does not measure learning and does not consume learning calls.

## Review and offline preparation

Use the source checkout and its pinned Bun version. All output paths below refer to new private directories outside repositories. These are contributor commands; packaged releases do not contain the source benchmark fixtures.

```bash
bun run cli eval --protocol preference-respect-v3 --phase review \
  --bundle-file "$PRIVATE_ROOT/heldout/bundle.json" \
  --review-file "$PRIVATE_ROOT/review.json"
```

Read the private review artifact. It includes each case's expected verdict, check kinds, and calibration fingerprint. Approval is an explicit decision on the displayed fingerprint:

```bash
bun run cli eval --protocol preference-respect-v3 --phase approve-review \
  --review-file "$PRIVATE_ROOT/review.json" --fingerprint "$REVIEW_FINGERPRINT"

bun run cli eval --protocol preference-respect-v3 --phase prepare-environments \
  --bundle-file "$PRIVATE_ROOT/heldout/bundle.json" \
  --review-file "$PRIVATE_ROOT/review.json" \
  --model "$LEARNER_MODEL" --effort medium --maximum-calls 16 \
  --output-directory "$PRIVATE_ROOT/environments"
```

Preparation pins one Codex learner, its CLI version, model, effort, source snapshot including untracked files, runtime, graders, corpus, and manual guidance. Three independent learning homes start with identical routed guidance. Both hosts and both synthetic repositories are captured. Git metadata is enabled only for those synthetic repositories; their prep remotes are identity fixtures and are never contacted. Background work is disabled. Offline routing and told setup preserve manual bytes exactly. Authorized learning may update a description and append published guidance while retaining the skill name, other metadata, file mode, and every original manual instruction. Replaced or removed manual text blocks qualification.

The corpus includes fixed synthetic observations binding each correction session to Atlas at its original timestamp. Preparation replays those observations through the production index API and verifies their scope against the registered synthetic repository. A read-only check repeats before any learner call. It requires all 22 assistant examples and user corrections to survive the native adapter and redacted materialization, retaining 11 paired steering episodes and excluding the tool-output decoy. Unknown historical sessions remain isolated. Missing bindings, missing context, changed remotes, and disabled Git-metadata consent stop preparation. The CLI emits the scope-check summary and automatically saves `learning-source.json`; no separate sealing script is needed.

Review approval does not authorize model execution. Each preparation allows at most sixteen calls, with a two-minute call timeout and twenty-minute preparation deadline. The complete learning ceiling is 48 calls. A lower per-preparation cap produces a correspondingly smaller approved ceiling.

The frozen preparation deadline is passed into the production learning execution as well as its native runner. Ordinary CLI learning keeps its existing limits. Offline calibration advances the clock beyond four minutes and verifies that extraction and publication still complete within the frozen window. Private per-call diagnostics and available native transport survive cleanup. If one preparation is incomplete, later preparations are not dispatched and no qualification environment is emitted.

## Bounded development preflight

Before paying for learner preparations, prepare `--experiment learning --run-phase preflight` from `preparation.json` without an environments file. This uses all sixteen public cases, bare and told only, and one repetition: 32 planned calls plus 32 reserved infrastructure replacements per scored model. Approve this scope separately. It uses no learning calls or held-out prompts and reports baseline saturation, unmet told checks, and execution gaps without confidence intervals. Do not drop checks in response. It qualifies scorer behavior and possible headroom only; it is not the final performance run.

## Separately authorized learning

After the user approves the pinned learner and complete ceiling, create the exact scope and execute it:

```bash
bun run cli eval --protocol preference-respect-v3 --phase approve-learning \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --fingerprint "$PREPARATION_FINGERPRINT"

bun run cli eval --protocol preference-respect-v3 --phase learn \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --scope-file "$PRIVATE_ROOT/environments/learning-scope.json" --yes
```

Production ingestion, `resolveRedacted`, extraction, reconciliation, and publication process only eligible synthetic instructions. Learner sandboxes have no tools or memory and deny access to the checkout, oracle, held-out bundle, and preparation storage. Each independent preparation has its own budget ledger and call records. Published text, pending proposals, absent expected rules, and suspected unsupported guidance are retained. Initial recognition of semantic coverage is heuristic. Missing or pending guidance is a learning outcome, not permission to substitute the told answers.

Inspect the three actual outputs against the independent target and negative evidence. Copy the emitted `learning-assessment-draft.json`, keep its preparation and published-text fingerprints, record missing rule ids and unsupported published keys with reasons, and set its decision to `reviewed`. Record it with `--phase review-learning --environments-file ... --assessment-file ...`. This model-free assessment changes diagnostic verdicts only; published guidance and pending proposals remain untouched. Qualification requires all three assessments. Development preflight can run with the initial heuristic diagnostics, clearly labeled `review-required`.

An interrupted preparation cannot silently acquire a new budget or rerun. Completed preparations are retained. A model or infrastructure failure makes that preparation incomplete and prevents qualification. Retain the evidence and approve a fresh cohort if another preparation is needed.

Run learning once per unchanged preparation set, then reuse its `environments.json` for every scored model. Resuming a candidate suite does not call learning. Bare/told preflight and the separate routing experiment need no learning at all.

For a new cohort after evaluator or documentation changes, materialize fresh environments with `prepare-environments`, then reuse the completed source:

```bash
bun run cli eval --protocol preference-respect-v3 --phase reuse-learning \
  --source-file "$PRIVATE_ROOT/original-environments/learning-source.json" \
  --preparation-file "$PRIVATE_ROOT/new-environments/preparation.json"
```

Reuse requires the automatically sealed production learning code, fixture setup, correction corpus, runtime inputs, initial guidance, learner model, effort, CLI, and all completed call ledgers to match. It records original provenance in the new cohort and makes no model calls. Review the retained outputs through `review-learning` before qualification. Changed learning implementation or inputs require fresh, separately authorized preparation. Reuse never inserts missing guidance or changes pending outcomes.

## Freeze each host cohort

Use the same three preparation outputs for every scored host/model. Deep repetition one uses preparation one, and so on. A host or model change requires its own qualification even if the product is unchanged.

```bash
bun run cli eval --protocol preference-respect-v3 --phase prepare \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --environments-file "$PRIVATE_ROOT/environments/environments.json" \
  --experiment learning --run-phase development \
  --engine codex --model "$SCORED_MODEL" --effort medium \
  --output-directory "$PRIVATE_ROOT/development"
```

Choose `claude-code` for Claude. Choose `qualification` only after the separately budgeted preflight and case review. The optional full `development` run compares five setups on the sixteen public cases. Qualification retains all 24 cases, including saturated or ambiguous checks; it never drops a case based on results. To run the routing experiment choose `--experiment routing`, omit `--environments-file`, and use a new output directory.

| Experiment             | Sessions per model | Planned turns | Reserved retry turns | Candidate ceiling | Shared preparation ceiling |
| ---------------------- | -----------------: | ------------: | -------------------: | ----------------: | -------------------------: |
| Bare/told preflight    |                 32 |            32 |                   32 |                64 |                          0 |
| Learning development   |                240 |           240 |                  240 |               480 |                         48 |
| Learning qualification |                360 |           360 |                  360 |               720 |                         48 |
| Routing                |                 72 |            72 |                   72 |               144 |                          0 |

The preparation ceiling is paid once for a shared cohort, not once per scored host. Qualification plus routing across four models has a ceiling of 3,504 calls including shared preparation. Most runs should use fewer; the ceiling includes one full replacement per cell. Subscription costs unavailable from CLIs stay unknown. No previous evaluation approval covers these calls.

## Validate, approve, execute, and grade

```bash
bun run cli eval --protocol preference-respect-v3 --phase validate \
  --suite-file "$PRIVATE_ROOT/development/suite.json"
```

Validation checks passing and failing grader outputs, boundaries and overrides, acceptance failures in the initial implementation, and passing reference implementations. It also performs a real read-only mount and sandbox answer-access probe, without authenticated calls. Codex cohorts additionally test the actual native CLI permission profile with writable and read-only workspaces, with memory enabled and disabled. Shared temporary reads and writes, grading-answer access, and guidance edits must be denied while the disposable workspace and private temporary directory remain usable. Native macOS sandbox checks must run outside an enclosing agent sandbox. Failed offline validation prevents execution. These model-free checks do not establish Claude sandbox qualification.

After approving this host, model, effort, phase, and printed invocation ceiling:

```bash
bun run cli eval --protocol preference-respect-v3 --phase approve-run \
  --suite-file "$PRIVATE_ROOT/development/suite.json" --fingerprint "$SUITE_FINGERPRINT"

bun run cli eval --protocol preference-respect-v3 --phase run \
  --suite-file "$PRIVATE_ROOT/development/suite.json" \
  --scope-file "$PRIVATE_ROOT/development/run-scope.json" --yes

bun run cli eval --protocol preference-respect-v3 --phase report \
  --suite-file "$PRIVATE_ROOT/development/suite.json"
```

Execution is serial. It persists ownership before dispatch and reserves every native invocation before starting. Resume revalidates fingerprints and preserves completed, unfavorable, and interrupted cells. Confirm that an interrupted process has ended before removing its private `.running` lock; keep its ledger. Interrupted or unclassified timed-out cells do not automatically rerun.

Reports read the mutable budget ledger through a bounded, schema-validated reader; the writer does not create a frozen-artifact sidecar for it. Suites and receipts remain independently fingerprinted. Reports charge reservations from the durable budget ledger even if interruption prevented recording them in an attempt. Unattributed reservations and pending dispatch leave execution incomplete. They cannot disappear by reconstructing spend from completed sessions.

One confirmed infrastructure failure permits one replacement in a fresh workspace. Both attempts remain in the receipt and count toward the ceiling. Known mount-command and acceptance-sandbox startup failures have stage diagnostics. Explicit provider quota refusals before any agent action create `provider-pause.json` and stop dispatch. Retain that artifact, wait for the stated reset, then remove the pause marker and its sidecar to resume under the same scope. Other provider failures and timeouts without confirmed classification remain unresolved. An observed preference, correctness, or safety failure is never erased by a cleanup retry. Mount, execution, verification, cleanup, and raw native transport remain private.

An unresolved setup, mount, verification, or cleanup failure creates `infrastructure-hold.json` and stops further dispatch after any permitted replacement. Resume respects the hold. Investigate its private evidence before removing the marker and sidecar. Ordinary model failures remain recorded outcomes and do not authorize replacement calls.

All remote actions use a local bare Git origin and recorded offline `gh` calls. Candidates cannot read their grading answers, change protected manual guidance, or contact real repository remotes. Native sandbox qualification is still needed on each host; advisory instructions alone do not enforce these boundaries.

## Scores and reuse

Within a session, score the share of required preference checks passed. Average complete repetitions and cases within each family, then average the eight family scores. Answer length contributes at most 12.5%. All whitespace-separated tokens in the final answer count, including code and fences. The default allows eighty inclusive; the 250-word override accepts 220 through 280 inclusive.

Correctness, safety, unsupported learning, selection, and execution completion have separate fields. Missing required evidence leaves the headline incomplete, without shrinking its denominator. Unknown checks remain unknown. Reports preserve preparation identities and every attempt.

Primary 95% intervals enumerate bootstrap resamples of the three whole repetition/preparation groups with the task mix fixed. Matched setups share the same resample. They do not resample individual checks or families. Three groups give coarse intervals; cohorts using the same preparations are correlated and cannot be pooled as independent samples.

Use `--phase compare --baseline-file ... --candidate-file ...` with suite files for matched product branches. Cases, original guidance and correction inputs, learner configuration, host versions, models, efforts, runtime, and budgets must match. Actual prepared outputs may differ as a result of the product change; both sets remain reported. Reuse this benchmark version for product changes. Change the version when the contract meaningfully changes, preserving the older records.

## Relation to the Claude.dev article

This implements fixed inputs, explicit scoring, grader calibration, separate development and held-out data, repeatable comparisons, and retained execution failures from [Automating eval design and hillclimbing with Claude](https://claude.dev/blog/automating-eval-design-and-hillclimbing/). It does not invoke the article's plugins or implement an autonomous optimizer. Offline tests cannot establish model headroom, effort scaling, production representativeness, or independent expert agreement.

Before publishing qualification results, run an independently budgeted development preflight when the selected hosts are available. Inspect ambiguous verdicts and report saturation without selectively removing checks. Keep held-out prompts and answers sealed from candidate optimization. Publish all setup and per-family scores, preparation outcomes, limits, execution gaps, and the phase used. The [results](../../evals.md) preserve the completed comparison and its measurement limits.
