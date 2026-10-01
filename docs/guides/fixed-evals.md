# Fixed preference evals

This contributor benchmark runs seven fixed tasks against four setups and grades the share of applicable engineering preferences followed. `preference-respect-v2` uses independently authored synthetic skills and user correction sessions. It never imports the evaluator's own skills, profile, or history.

| Setup | Personal guidance |
| --- | --- |
| `bare` | Shared repository requirements only |
| `skills` | A handwritten existing skill about comments, type safety, and options objects |
| `routing` | The same unchanged skill plus Shadowclone initialization and native routing, with learning disabled |
| `deep` | Identical routed guidance, followed by actual Shadowclone learning from fixed synthetic corrections about Git authorization and answer length |

The independently written [target profile](../../src/eval/fixed/fixtures/profile.ts) grades every setup. The [existing skill and provenance split](../../src/eval/fixed/workflow/definition.ts), [correction sessions](../../src/eval/fixed/workflow/fixtures.ts), and [tasks and hidden acceptance tests](../../src/eval/fixed/fixtures/tasks.ts) are reviewable fixtures. The learner receives eligible correction excerpts through production ingestion and `resolveRedacted`, then extraction, review, and publication. It does not receive the target profile, task solutions, or graders. Learning proposals are automatically applied only inside these synthetic environments, under the approved evaluation scope.

The seven tasks cover adding an API, discount rounding, a two-turn parser extension, deduplication, immutable sorting, an explicit comment override, and concise advice. Tasks, checks, and the provenance split stay fixed across hosts and models. A model passing a check never causes that check to disappear. Skill reads are delivery evidence; compliance comes from grading the resulting work.

## Prepare environments

Run from a Shadowclone source checkout after installing its dependencies. Packaged builds do not run this contributor benchmark. Use the same Bun version throughout. Contributor commands use the source runner; each directory must be new and outside every repository.

```bash
bun run cli eval --protocol preference-respect-v2 --phase prepare-environments \
  --engine codex --model <learner-model> --effort medium --maximum-calls 16 \
  --output-directory /private/tmp/preference-environments
```

This phase makes no model calls. It freezes the original skill bytes, correction files, profile, tasks, product snapshot including untracked files, grader code, runtime, learner CLI version, model, effort, and budget. Both host integrations are captured. The routed and pre-learning environments must match exactly, and preparation must preserve the manual skill.

Inspect `preparation.json`. Authenticated learning needs a separately approved engine, model, effort, and call scope. After approval:

```bash
bun run cli eval --protocol preference-respect-v2 --phase learn \
  --preparation-file /private/tmp/preference-environments/preparation.json --yes
```

Learning allows at most sixteen native invocations, two minutes per invocation, and twenty minutes total. The runner pins model, effort, and CLI version, forbids tool actions, and records every charged attempt. Only the private synthetic transcript source and skill library are enabled; background work stays disabled. Managed restrictions still apply. `environments.json` freezes the output and actual learning receipt for both Claude Code and Codex. Pending decisions, errors, incomplete processing, or changed manual skills prevent a scored run. Failed or interrupted preparation is retained and cannot silently restart with a fresh budget.

Use one prepared environment file for every scored model to keep its learned guidance identical. Repeating preparation is a separate source of variation and requires its own approved scope. A complete learning attempt can publish no useful rule; do not insert missing expected preferences or retry based on a poor score.

## Freeze and validate tasks

```bash
bun run cli eval --protocol preference-respect-v2 --phase prepare \
  --environments-file /private/tmp/preference-environments/environments.json \
  --engine codex --model <scored-model> --effort medium --repetitions 3 \
  --output-directory /private/tmp/preference-eval-candidate

bun run cli eval --protocol preference-respect-v2 --phase validate \
  --suite-file /private/tmp/preference-eval-candidate/suite.json
```

Choose `claude-code` for Claude Code. Scored preparation freezes that host's CLI version and configuration and makes no model calls. Three repetitions produce 84 sessions and at most 96 native turns per model. Execution is serial, with a four-minute code-turn limit, a two-minute advice-turn limit, and a three-hour matrix deadline. Costs unavailable from subscription CLIs stay unknown.

Validation checks positive and negative deterministic-grader examples and their stability. Initial code must fail hidden acceptance tests; references must pass. It makes no model calls. Reference answers and hidden tests remain outside candidate workspaces until verification. Candidate access policies block the current cohort's preparation root and template; shared learning artifacts are stored separately and are not candidate inputs. macOS verification must run outside an enclosing agent sandbox when nested sandbox startup is unavailable. Failed validation prevents scored model execution.

## Run and grade

After approving the frozen scored model and call scope:

```bash
bun run cli eval --protocol preference-respect-v2 --phase run \
  --suite-file /private/tmp/preference-eval-candidate/suite.json --yes

bun run cli eval --protocol preference-respect-v2 --phase report \
  --suite-file /private/tmp/preference-eval-candidate/suite.json
```

`--yes` authorizes calls for that phase and Git writes only inside disposable fixture repositories. It grants no authority in the contributor's checkout or on GitHub. Managed engine and action ceilings remain authoritative.

The headline is the proportion of preference checks passed within each task, averaged with equal weight across the seven tasks. Partial compliance earns partial credit. Three repetitions give 75 preference observations per setup. Correctness, safety, and whole-task success are recorded separately. The functional advice-content check is excluded from preference adherence. Confidence intervals resample tasks and then whole sessions, preserving correlated checks within a session.

`report.json` records every cell, preference verdict and evidence, correctness, safety, delivery reads, time, nullable cost, learning provenance, and six setup comparisons. `scored/receipt.json` retains private code, responses, actions, and errors. No final score is emitted until all four setups have the complete expected matrix and confirmed model identities. Missing, failed-to-run, and unknown evidence cannot shrink the denominator. Observed preference failures remain scored failures.

Resume uses the same `run` command and suite. Completed, unfavorable, and interrupted cells are retained and not rerun. A changed product, input, host version, or expired deadline requires a new run. After confirming an interrupted process ended, remove only its private `.running` lock and retain its budget and receipt. Prepare a new directory to rerun every task.

## Compare product revisions

Run separately from each source branch or worktree with identical settings and independently prepared environments. The comparator changes no Git references.

```bash
bun run cli eval --protocol preference-respect-v2 --phase compare \
  --baseline-file /private/tmp/preference-eval-baseline/report.json \
  --candidate-file /private/tmp/preference-eval-candidate/report.json
```

Both reports must be complete and share tasks, target profile, original skills, correction contents, graders, runtime, host and CLI version, learner and scored-model configuration, repetitions, and limits. The comparison reports candidate minus baseline with bootstrap intervals for each setup. Learned output may differ between preparations; their recorded fingerprints make that variation inspectable. Compare different models as separately labeled cohorts, rather than as a matched product revision.

## Authenticated run record

The 2026-10-01 study ran all four requested model cohorts against the same frozen tasks, graders, existing skill, corrections, and learned output. [Published scores and intervals](../../evals.md#fixed-four-setup-results-2026-10-01) show the subsequently requested completed-session analysis, excluding one timed-out Luna attempt. The frozen full-matrix report remains unchanged and incomplete for Luna.

| Configuration | Value |
| --- | --- |
| Protocol and scorer | `preference-respect-v2`, `preference-share-1` |
| Scored models | `gpt-6.1-sol` medium, `gpt-6-luna` high, `claude-opus-5-5` medium, `claude-sonnet-5-5` high |
| Host versions | `codex-cli 0.159.0`, Claude Code `2.1.284` |
| Harness runtime | Bun `1.4.2`, TypeScript `5.9.3`, macOS |
| Acceptance runtime | Bun `1.3.3` for recorded verification commands |
| Sampling | Seven tasks, four setups, three repetitions, serial within each model |
| Analysis | 10,000 task-and-session bootstrap draws, seed `20261001` |
| Learning | One Codex Sol medium preparation, six invocations, two episodes, two published rules, no pending decisions |
| Learning ceiling | Sixteen native invocations, 120 seconds each, 1,200 seconds total |
| Scoring ceiling | 96 native turns per model, 240 seconds per code turn, 120 seconds per advice turn |
| Actual execution | 383 scored turns and six learning turns; 335 complete sessions and one timeout |

The benchmark fingerprint is `87ab873bedd5a08f75daf293140e4e40d5a5b34e12de55125ac692a9b7584b0a`; the grader fingerprint is `0d724559ece2b3b231c58db9ff77feaa72ba70e89f33eb32b79f65355a6cf56b`. Execution froze a working-tree snapshot above commit `dbabda30094c5a1c1dc4509b96aeba90b6339f4d`, including the uncommitted fixed benchmark. These results do not claim to test a later documentation or release commit.

Cells below give preference checks passed, failed, and unknown in the original receipts, in that order. Each setup has 75 expected checks. These pooled counts differ from task-weighted scores. The additional completed-session view excludes Luna's four unknown checks, leaving 71 observed existing-skills checks and 75 in every other setup.

| Setup | GPT 6.1 Sol | GPT 6 Luna | Sonnet 5.5 | Opus 5.5 |
| --- | ---: | ---: | ---: | ---: |
| Bare | 71 / 4 / 0 | 72 / 3 / 0 | 49 / 26 / 0 | 43 / 32 / 0 |
| Existing skills | 75 / 0 / 0 | 71 / 0 / 4 | 55 / 20 / 0 | 54 / 21 / 0 |
| Routing | 75 / 0 / 0 | 75 / 0 / 0 | 55 / 20 / 0 | 54 / 21 / 0 |
| Deep learning | 75 / 0 / 0 | 75 / 0 / 0 | 65 / 10 / 0 | 72 / 3 / 0 |

Every complete session passed correctness and safety checks. Luna's first turn on the second existing-skills parser-extension repetition reached 240 seconds before a confirmed result. Its second turn was not dispatched, leaving 95 charged turns in that cohort. The timed-out cell and its four unknown preference checks were retained without a retry. Other cohorts used 96 turns each. No observed preference failure was removed. Only the additional completed-session analysis excludes the failed-to-run cell; it does not replace the frozen report or the CLI's complete-matrix requirement.

The additional view averages observed preference compliance within each task, giving all seven tasks equal weight. Luna has two completed existing-skills parser-extension repetitions and three for every other task and setup. It uses the same task-and-session bootstrap with 10,000 draws and seed `20261001`, resampling only completed sessions. This denominator choice was requested after results were inspected, so it is disclosed as a post-run analysis. Luna scores 97.1% bare and 100% in each guided setup on that view. A timeout cannot be interpreted as evidence of compliance.

An offline audit recomputed every grade and interval from the raw receipts, confirmed identical product and benchmark fingerprints across cohorts, checked observed model identities, and reconciled every charged turn with the budget. Private receipts retain generated code, responses, actions, model confirmation, learning output, and per-cell verification evidence. Public material includes only synthetic fixtures and aggregate measurements.

The learner is one source of variation: this study reused its single prepared output and does not estimate variation across learning preparations. Git authorization was respected in every observed setup. Claude's incremental learning gain came chiefly from answer length; routing by itself produced no gain in the completed-session view. Both Codex models reached 100% with the original three-rule skill on completed sessions. A 100% bootstrap interval on these observations does not imply universal reliability.

## Interpretation and prior protocols

These are public development and regression tasks, already used before the four-setup provenance split was authored. They are not held-out evidence. Fixed fixtures do not by themselves establish grader validity, broad learning quality, useful engineering throughput, or hillclimbing success. Human review, model calibration, and a separately inaccessible test split remain necessary for those claims. See the [evaluation design reference](https://claude.dev/blog/automating-eval-design-and-hillclimbing/) and [design history](../design/027-preference-study.md).

### How this follows the Claude.dev recommendations

This benchmark adopts parts of [Automating eval design and hillclimbing with Claude](https://claude.dev/blog/automating-eval-design-and-hillclimbing/). It is a fixed regression suite with inspected execution evidence. It does not implement the article's complete evaluation-design or hillclimbing workflow, and it does not invoke `/claude-api build-eval` or `/claude-api hillclimb`.

| Recommendation | Shadowclone implementation and remaining gap |
| --- | --- |
| Use relevant tasks | The seven tasks exercise code style, existing APIs, a resumed conversation, explicit preference overrides, and answer length; they are small synthetic examples, not a representative production sample |
| Avoid selecting cases by one model's failures | Tasks and the five-rule target stay fixed across models, including checks already passed by bare; no result removes a task or rule, and the later provenance split is disclosed |
| Calibrate model and effort | Actual model identity, effort, host version, and runtime are frozen; the study has no within-model effort sweep and does not establish monotonic capability scaling |
| Preserve room for improvement | Claude leaves measurable room for learning, but both Codex models reach 100% with skills on completed sessions and cannot demonstrate further quality gains on this set |
| Validate inexpensive graders | Programmatic checks and hidden functional tests have positive, negative, stability, and mutation examples; private outputs were inspected, but independent domain-expert agreement has not been measured |
| Measure variation and execution errors | Three repetitions and task-and-session bootstrap intervals retain correlated checks; Luna's frozen headline stays incomplete, its requested completed-session view discloses the exclusion, and the small sample does not establish low variance |
| Separate solutions from candidate inputs | References and hidden tests are withheld until verification, cohort preparation storage is blocked, and the learner gets eligible synthetic corrections; public development fixtures are not an inaccessible test split |
| Improve one surface against unseen cases | Matched branch comparison is available; automatic optimization, a private train/test split, and held-out regression decisions are not implemented |

Functional acceptance follows the stated requests. Personal preferences come from the separate, independently written target profile; the four setups intentionally receive different subsets of that guidance. This tests preference learning and delivery, with preference misses reported separately from functional failure. It is an adaptation of the article's grading advice rather than a claim that every baseline task states the withheld preferences.

A future optimization study needs human-reviewed production-shaped tasks, fresh private test cases frozen before inspecting preference coverage, a model-and-effort calibration sweep, and a predeclared improvement large enough to distinguish from noise. Each candidate change should be assessed on unseen cases while preserving failed and interrupted evidence. The current public tasks remain regression tests; repeated tuning on them cannot become held-out proof.

`preference-respect-v1` remains a separate three-setup delivery experiment: bare, the full profile in native instructions, and the full profile in a maintained Shadowclone skill. Its original reports use whole-task pass rates. Use `eval --protocol preference-respect-v1 --help` to retain those commands and reports. They cannot be relabeled or reused as the four-setup result. The older `preference-study-v1` learning study has different inputs and controls and remains documented in the [architecture guide](../architecture/09-evaluation.md).
