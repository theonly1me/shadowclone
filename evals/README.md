# Evaluations

This folder holds the evaluation suites of Shadowclone. Maintainers run them from a source checkout. The published CLI does not contain them.

The [results](../evals.md) compare five setups on four models. This page explains how to run the suites and what each one measures.

## Suites

| Suite                | Run it with                                      | What it measures                                                                                               |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Preference benchmark | `bun run eval --protocol preference-respect-v3`  | How well learning keeps your rules, and how well agents receive them                                           |
| Routing experiment   | The same command with `--experiment routing`     | Whether native startup routing changes skill selection and compliance                                          |
| Work suite           | `bun run eval:work`                              | Whether the `shadowclone-work` skill takes a case to a pull request that is ready                              |
| Workflow outcomes    | `bun run eval --protocol workflow-outcomes-v1`   | Outcomes of frozen tasks under three conditions: existing skills, current Shadowclone, and an evolved workflow |
| Pull request review  | [`pr-review/README.md`](pr-review/README.md)     | The precision of pull request reviewers on merged pull requests                                                |
| No-comments          | [`no-comments/README.md`](no-comments/README.md) | Whether agents write more readable code when they cannot write comments                                        |

The CLI also accepts the earlier protocols `preference-respect-v1`, `preference-respect-v2`, and `preference-study-v1`.

## Rules for paid runs

1. Review, preparation, and offline validation make no authenticated call.
2. An authenticated phase (`learn` or `run`) needs a newly approved scope. Run the `approve-*` phase on the printed fingerprint first.
3. The scope names the host, the model, the effort, and the call ceiling. Pass `--yes` only for that exact scope.
4. An earlier approval never covers a new scope.
5. Keep suites, keys, agent homes, and receipts in a new private directory outside every repository. The tools refuse a folder inside a repository.
6. Keep held-out cases outside every checkout. Only their hashes and family coverage are public.

## Preference benchmark

Use the source checkout and its pinned Bun version. Every output path below is a new private directory.

### The fixed contract

The benchmark has 24 synthetic tasks in eight preference families. Each family has 2 development cases and 1 held-out case. Each family has a headline weight of 12.5%. The families are comments, types, API conventions, Git authorization, answer length, test-first behavior, pull request structure, and scope and lifecycle.

| Setup                                     | Guidance                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Agent alone                               | Shared repository requirements                                              |
| Existing user skills                      | Unchanged handwritten code-style skill                                      |
| Existing skills + Shadowclone routing     | The same library with production initialization and native startup guidance |
| Existing skills + handwritten preferences | The routed library plus independently handwritten intended learned guidance |
| Existing skills + Shadowclone learning    | The routed library plus the actual learning output                          |

Handwritten and learned guidance use the same delivery path. Neither adds answers to the task prompts. Saved receipts call them `told` and `deep`. The gap between them measures how closely learning follows the intended guidance. The gap between learning and routing measures the effect of learning.

These authored inputs stay separate from each other:

- [Public cases](fixed/reusable/cases/)
- [Target specification](fixed/reusable/oracle.ts)
- [Manual guidance](fixed/reusable/guidance.ts)
- [Correction corpus](fixed/reusable/corpus.ts)
- [Held-out manifest](fixed/reusable/heldout-manifest.json)

The corpus has repeated examples, conditional defaults, a one-task waiver, a replacement of an older instruction, and insufficient evidence. Tool-result decoys must not enter eligible learning text.

The eight held-out cases live in a private bundle. Back it up on its own, because hashes cannot rebuild it. Do not give it to an optimizer. Human reviewers inspect its case and verdict specification before the freeze. Candidates read its prompts only during qualification. Development uses the 16 public cases.

The [routing experiment](fixed/reusable/routing.ts) compares the same 20 manual skills with and without routing on 12 public cases. Selection needs the relevant skill read and no unrelated library read. Compliance checks the generated code on its own. The experiment uses no learning calls.

### 1. Review and prepare

Read the private review artifact first. It lists the expected verdict, the check kinds, and the calibration fingerprint of each case. Approval is an explicit decision on the shown fingerprint.

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

Preparation pins one Codex learner, its CLI version, model, effort, source snapshot, runtime, graders, corpus, and manual guidance. It creates three independent learning homes with the same routed guidance. A read-only check runs before any learner call. All 22 assistant examples and user corrections must survive the native adapter and redacted materialization. That keeps 11 paired steering episodes and drops the tool-output decoy.

Review approval does not authorize a model call. Each preparation allows at most 16 calls, a two-minute call timeout, and a 20-minute deadline. The full learning ceiling is 48 calls.

### 2. Bounded development preflight (optional)

Before you pay for learner preparations, prepare `--experiment learning --run-phase preflight` from `preparation.json`, without an environments file. The run uses the 16 public cases, the bare and told setups, and one repetition. It uses no learning call and no held-out prompt. Approve this scope on its own.

The preflight reports baseline saturation and unmet told checks. It qualifies the scorer and shows the room for gains. It is not the final run. Do not drop checks because of its results.

### 3. Learn

After you approve the pinned learner and the full ceiling, create the exact scope and run it:

```bash
bun run eval --protocol preference-respect-v3 --phase approve-learning \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --fingerprint "$PREPARATION_FINGERPRINT"

bun run eval --protocol preference-respect-v3 --phase learn \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --scope-file "$PRIVATE_ROOT/environments/learning-scope.json" --yes
```

Learning uses the production ingestion, `resolveRedacted`, extraction, reconciliation, and publication paths on synthetic instructions only. Learner sandboxes have no tools and no memory. The run keeps published text, pending proposals, absent expected rules, and suspected unsupported guidance. Missing or pending guidance is a learning outcome. Never replace it with the told answers.

To review the three outputs against the independent target:

1. Copy the `learning-assessment-draft.json` that the run wrote.
2. Keep its preparation and published-text fingerprints.
3. Record the missing rule ids and the unsupported published keys, with reasons.
4. Set its decision to `reviewed`.
5. Record it with `--phase review-learning --environments-file ... --assessment-file ...`.

This step uses no model. Qualification needs all three assessments.

An interrupted preparation gets no new budget without approval. A model or infrastructure failure makes a preparation incomplete and blocks qualification. Keep the evidence and approve a fresh cohort.

To reuse completed learning for a new cohort, build fresh environments with `prepare-environments`. Then run `--phase reuse-learning --source-file .../learning-source.json --preparation-file .../preparation.json`. Reuse makes no model call. It needs a match on these items:

- The sealed learning code, the fixture setup, and the corpus.
- The runtime inputs, the initial guidance, the learner model, the effort, and the CLI.
- All call ledgers.

A change to the learning code or inputs needs a fresh, separately authorized preparation.

### 4. Freeze each cohort

Use the same three preparation outputs for every scored agent and model. A change of agent or model needs its own qualification.

```bash
bun run eval --protocol preference-respect-v3 --phase prepare \
  --preparation-file "$PRIVATE_ROOT/environments/preparation.json" \
  --environments-file "$PRIVATE_ROOT/environments/environments.json" \
  --experiment learning --run-phase development \
  --engine codex --model "$SCORED_MODEL" --effort medium \
  --output-directory "$PRIVATE_ROOT/development"
```

Use `--engine claude-code` for Claude. Choose `--run-phase qualification` only after the preflight and the case review. Qualification keeps all 24 cases. For the routing experiment, use `--experiment routing`, omit `--environments-file`, and use a new output directory.

| Experiment             | Sessions per model | Planned turns | Reserved retry turns | Candidate ceiling | Shared preparation ceiling |
| ---------------------- | -----------------: | ------------: | -------------------: | ----------------: | -------------------------: |
| Bare/told preflight    |                 32 |            32 |                   32 |                64 |                          0 |
| Learning development   |                240 |           240 |                  240 |               480 |                         48 |
| Learning qualification |                360 |           360 |                  360 |               720 |                         48 |
| Routing                |                 72 |            72 |                   72 |               144 |                          0 |

A shared cohort pays the preparation ceiling once. Qualification plus routing across four models has a ceiling of 3,504 calls. Most runs use fewer calls, because the ceiling includes one full replacement for each cell.

### 5. Validate, approve, run, and report

```bash
bun run eval --protocol preference-respect-v3 --phase validate \
  --suite-file "$PRIVATE_ROOT/development/suite.json"

bun run eval --protocol preference-respect-v3 --phase approve-run \
  --suite-file "$PRIVATE_ROOT/development/suite.json" --fingerprint "$SUITE_FINGERPRINT"

bun run eval --protocol preference-respect-v3 --phase run \
  --suite-file "$PRIVATE_ROOT/development/suite.json" \
  --scope-file "$PRIVATE_ROOT/development/run-scope.json" --yes

bun run eval --protocol preference-respect-v3 --phase report \
  --suite-file "$PRIVATE_ROOT/development/suite.json"
```

Validation checks passing and failing grader outputs, acceptance failures in the initial implementation, and passing reference implementations. It runs a real read-only mount and an answer-access probe, with no authenticated call. A failed validation blocks the run. Run the native macOS sandbox checks outside any enclosing agent sandbox. These checks do not qualify the Claude sandbox.

The run is serial. It saves ownership and reserves every native invocation before it starts. A resume checks the fingerprints again and keeps completed, unfavorable, and interrupted cells.

### Failures and resumes

- One confirmed infrastructure failure allows one replacement in a fresh workspace. Both attempts stay in the receipt and count toward the ceiling.
- A clear provider quota refusal before any agent action creates `provider-pause.json` and stops dispatch. Wait for the stated reset, then remove the marker and its sidecar.
- An unresolved setup, mount, verification, or cleanup failure creates `infrastructure-hold.json`. Read its private evidence before you remove the marker.
- An ordinary model failure is a recorded outcome. It does not authorize a replacement call.
- Before you remove the `.running` lock of an interrupted process, confirm that the process ended. Keep its ledger.
- A report charges every reservation in the durable ledger. An unattributed reservation or a pending dispatch leaves the run incomplete.

### Isolation

Each task gets a disposable repository and an isolated agent home. Candidates cannot read their grading answers, change protected manual guidance, or contact a real remote. All remote actions use a local bare Git origin and recorded offline `gh` calls. Verification runs without provider credentials or network access. Each host needs its own native sandbox qualification, because advisory instructions do not enforce these limits.

### Scores and comparison

A session score is the share of required preference checks that pass. Average complete repetitions and cases inside each family. Then average the eight family scores.

- Answer length counts all whitespace-separated tokens in the final answer, including code and fences. The default allows 80 tokens. The 250-word override accepts 220 through 280.
- Correctness, safety, unsupported learning, selection, and completion have separate fields. Missing required evidence leaves the headline incomplete.
- The 95% intervals resample the three whole repetition and preparation groups, with the task mix fixed. Three groups give coarse intervals. Cohorts that share preparations correlate, so do not pool them.
- To compare two product branches, run `--phase compare --baseline-file ... --candidate-file ...` with suite files. Cases, inputs, learner configuration, agent versions, models, efforts, runtime, and budgets must match.

Reuse this benchmark version for product changes. Change the version when the contract changes, and keep the older records.

## Work suite

`bun run eval:work` runs `claude plugin eval` on cases built from synthetic pull request histories. Each case has a local bare remote and a stand-in for `gh`. A grader reads each kept run after it ends. It checks the code checks on the final head and that the pull request is ready and not merged. It also checks the thread replies, that no words appear on the pull request, and that no history rewrite happens outside `gh stack`. [Design record 030](../docs/design/030-shadowclone-work-eval.md) describes the arms and the cases.

## Other suites

The [pull request review suite](pr-review/README.md) compares reviewers on merged pull requests. The [no-comments suite](no-comments/README.md) compares code written with and without a comment ban.

## Reading the results

Public reports hold aggregate scores and measurement limits. They hold no prompts, transcripts, credentials, identifying paths, or generated code. The benchmark follows [Automating eval design and hillclimbing with Claude](https://claude.dev/blog/automating-eval-design-and-hillclimbing/). It has no autonomous optimizer.

Offline tests cannot show model headroom, effort scaling, production representativeness, or agreement between independent experts. Before you publish qualification results, inspect ambiguous verdicts and report saturation without removing checks. Publish all setup and family scores, the preparation outcomes, the limits, and the phase that you used.
