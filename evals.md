# Evaluation results

The evaluation tests whether coding agents follow engineering preferences across 24 fixed tasks. Every setup ran all tasks three times on each model. All planned tasks remain in the comparison. Tables use final authorized attempts; earlier interrupted attempts and partial checks remain in private records.

## Preference adherence

Each task checks its assigned preference family. The score averages repetitions and tasks within each family, then gives each of eight families equal weight. It measures preference adherence, not overall task success or code quality. Each setup and model contains 72 sessions.

| Setup                                     | GPT 6.1 Sol | GPT 6 Luna | Claude Sonnet 5.5 | Claude Opus 5.5 |
| ----------------------------------------- | ----------: | ---------: | ----------------: | --------------: |
| Agent alone                               |       77.3% |      59.0% |             56.5% |           53.2% |
| Existing user skills                      |       85.2% |      80.6% |             76.4% |           73.6% |
| Existing skills + Shadowclone routing     |       86.1% |      72.7% |             76.9% |           75.9% |
| Existing skills + handwritten preferences |       92.4% |      81.2% |             91.7% |           86.1% |
| Existing skills + Shadowclone learning    |       89.4% |      83.3% |             90.0% |           82.9% |

Shadowclone learning scores above existing user skills on all four models. Handwritten preferences score higher than learned preferences on GPT 6.1 Sol, Claude Sonnet 5.5, and Claude Opus 5.5. GPT 6 Luna records a higher learned-preference point estimate. Learning delivery, incomplete learned guidance, and model behavior all affect this comparison.

## What each setup means

| Setup                                     | What the agent receives                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Agent alone                               | Shared repository requirements, with no personal skills or preferences                                              |
| Existing user skills                      | The same requirements plus an unchanged synthetic code-style skill                                                  |
| Existing skills + Shadowclone routing     | The same skill library plus Shadowclone's native startup guidance, without learning                                 |
| Existing skills + handwritten preferences | The routed library plus independently handwritten intended rules, a reference comparison rather than a product mode |
| Existing skills + Shadowclone learning    | The routed library plus actual rules published by Shadowclone from synthetic correction sessions                    |

Handwritten and learned preferences use the same delivery path. The learner never receives the intended rules or grading answers. These setups are named `bare`, `skills`, `routing`, `told`, and `deep` in saved receipts.

## Per-preference results

The columns follow the setup definitions above. Each family contains three tasks and three repetitions. Answer length contributes at most 12.5% to the headline.

### GPT 6.1 Sol

| Preference          | Agent alone | User skills | + Shadowclone routing | + Handwritten preferences | + Shadowclone learning |
| ------------------- | ----------: | ----------: | --------------------: | ------------------------: | ---------------------: |
| Comments            |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| Type safety         |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| API conventions     |       33.3% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| Git authorization   |       51.9% |       48.1% |                 55.6% |                    100.0% |                  81.5% |
| Answer length       |       66.7% |       66.7% |                 66.7% |                     66.7% |                  66.7% |
| Test-first behavior |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| PR structure        |       66.7% |       66.7% |                 66.7% |                     72.2% |                  66.7% |
| Scope and lifecycle |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |

### GPT 6 Luna

| Preference          | Agent alone | User skills | + Shadowclone routing | + Handwritten preferences | + Shadowclone learning |
| ------------------- | ----------: | ----------: | --------------------: | ------------------------: | ---------------------: |
| Comments            |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| Type safety         |       44.4% |       88.9% |                100.0% |                     88.9% |                 100.0% |
| API conventions     |       33.3% |      100.0% |                 88.9% |                    100.0% |                  88.9% |
| Git authorization   |       77.8% |       77.8% |                 70.4% |                    100.0% |                  88.9% |
| Answer length       |       44.4% |       66.7% |                 44.4% |                     44.4% |                  66.7% |
| Test-first behavior |       33.3% |       55.6% |                 33.3% |                     33.3% |                  44.4% |
| PR structure        |       66.7% |       66.7% |                 66.7% |                     83.3% |                  77.8% |
| Scope and lifecycle |       72.2% |       88.9% |                 77.8% |                    100.0% |                 100.0% |

### Claude Sonnet 5.5

| Preference          | Agent alone | User skills | + Shadowclone routing | + Handwritten preferences | + Shadowclone learning |
| ------------------- | ----------: | ----------: | --------------------: | ------------------------: | ---------------------: |
| Comments            |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| Type safety         |        0.0% |      100.0% |                100.0% |                    100.0% |                  88.9% |
| API conventions     |       33.3% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| Git authorization   |       55.6% |       55.6% |                 55.6% |                    100.0% |                  85.2% |
| Answer length       |        0.0% |        0.0% |                  0.0% |                     55.6% |                  77.8% |
| Test-first behavior |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| PR structure        |       66.7% |       66.7% |                 66.7% |                     77.8% |                  72.2% |
| Scope and lifecycle |       96.3% |       88.9% |                 92.6% |                    100.0% |                  96.3% |

### Claude Opus 5.5

| Preference          | Agent alone | User skills | + Shadowclone routing | + Handwritten preferences | + Shadowclone learning |
| ------------------- | ----------: | ----------: | --------------------: | ------------------------: | ---------------------: |
| Comments            |       77.8% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| Type safety         |       22.2% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| API conventions     |       33.3% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| Git authorization   |       48.1% |       44.4% |                 51.9% |                    100.0% |                  81.5% |
| Answer length       |        0.0% |        0.0% |                  0.0% |                     22.2% |                  22.2% |
| Test-first behavior |      100.0% |      100.0% |                100.0% |                    100.0% |                 100.0% |
| PR structure        |       66.7% |       66.7% |                 66.7% |                     66.7% |                  66.7% |
| Scope and lifecycle |       77.8% |       77.8% |                 88.9% |                    100.0% |                  92.6% |

## Matched comparisons

Differences are percentage points. The 95% bootstrap intervals resample the three matched repetition and learning-preparation groups while keeping the task mix fixed. Three groups give coarse intervals. Models share preparations, so their results are correlated and cannot be pooled as independent samples.

| Model             | Learning over routing | 95% interval  | Learning over handwritten preferences | 95% interval |
| ----------------- | --------------------: | ------------- | ------------------------------------: | ------------ |
| GPT 6.1 Sol       |                  +3.2 | 0.0 to +5.1   |                                  -3.0 | -6.9 to -0.7 |
| GPT 6 Luna        |                 +10.6 | +2.1 to +16.2 |                                  +2.1 | 0.0 to +3.5  |
| Claude Sonnet 5.5 |                 +13.2 | +8.3 to +15.7 |                                  -1.6 | -2.8 to -0.7 |
| Claude Opus 5.5   |                  +6.9 | +1.4 to +10.6 |                                  -3.2 | -5.6 to -1.4 |

## Separate routing comparison

A second experiment uses 20 synthetic skills and twelve tasks, with three repetitions per setup. It measures skill selection and implementation compliance separately. Reading a skill earns no compliance credit.

| Model             | Existing skills, preference adherence | Existing skills + Shadowclone routing, preference adherence |
| ----------------- | ------------------------------------: | ----------------------------------------------------------: |
| GPT 6.1 Sol       |                                100.0% |                                                      100.0% |
| GPT 6 Luna        |                                100.0% |                                                       97.2% |
| Claude Sonnet 5.5 |                                100.0% |                                                      100.0% |
| Claude Opus 5.5   |                                100.0% |                                                      100.0% |

Both Claude models selected the expected skills in every session. Codex read tracking missed some successful reads; the original tracking verdicts remain retained. Task names directly match skill names, and the added routing is generic startup guidance. This experiment does not establish an advantage for explicit production skill routes. It also does not establish that production routing is unnecessary.

## Correctness, safety, and learning

Preference adherence remains separate from correctness. The following raw correctness counts use all 72 sessions per setup and retain the original acceptance verdicts. API and advice acceptance constraints limit their interpretation, as described below. Routing correctness is not compared because its acceptance assumes a fixed module location.

| Setup                                     | GPT 6.1 Sol | GPT 6 Luna | Claude Sonnet 5.5 | Claude Opus 5.5 |
| ----------------------------------------- | ----------: | ---------: | ----------------: | --------------: |
| Agent alone                               |       72/72 |      69/72 |             71/72 |           72/72 |
| Existing user skills                      |       72/72 |      72/72 |             68/72 |           69/72 |
| Existing skills + Shadowclone routing     |       71/72 |      70/72 |             69/72 |           69/72 |
| Existing skills + handwritten preferences |       70/72 |      72/72 |             69/72 |           69/72 |
| Existing skills + Shadowclone learning    |       70/72 |      72/72 |             68/72 |           69/72 |

All planned sessions completed. Protected manual guidance remained unchanged in every final session. This safety check covers guidance preservation only. Git authorization has separate checks and recorded failures, including offline remote actions. No fixture action reached a real repository remote.

Three independent learning preparations used GPT 6.1 Sol at medium effort. One published four intended rules and left Git guidance pending; the other two published five. All three published partial PR guidance. The bounded agent assessment found no unsupported published guidance. Actual outputs were retained without adding missing rules.

## Method and measurement limits

The study ran on 2026-10-03. It contains 1,440 five-setup sessions and 288 separate routing sessions. Each family has two public development tasks and one private held-out task. Cases, graders, guidance, and denominators were frozen before candidate execution. Each task uses a disposable repository and isolated agent home. Existing personal setup is not imported or changed. Remote actions use offline fixtures.

| Model             | Agent host  | Effort | Host version |
| ----------------- | ----------- | ------ | ------------ |
| GPT 6.1 Sol       | Codex       | Medium | 0.159.0      |
| GPT 6 Luna        | Codex       | High   | 0.159.0      |
| Claude Sonnet 5.5 | Claude Code | High   | 2.1.287      |
| Claude Opus 5.5   | Claude Code | Medium | 2.1.287      |

The declared runtime uses Bun 1.4.2 and TypeScript 5.9.3. Acceptance logs contain both Bun 1.3.3 and 1.4.2, so this is not a uniform toolchain comparison. Effort settings are fixed within each cohort; the study does not isolate model size or effort scaling.

A targeted agent audit inspected twenty saved sessions across all families and models without changing scores. Some preference graders check syntax and patterns. API acceptance assumes fixed option names despite allowing API choice. An advice keyword check can reject an equivalent explanation. These limits prevent a clean correctness or general engineering-quality claim. The audit is not independent human review.

Claude continuation after a quota reset used explicitly authorized manual retries outside the automatic retry rule. Original attempts, partial checks, and call accounting remain private and unchanged. No failures were silently removed or rescored.

The design applies fixed inputs, programmatic checks, isolated execution, held-out cases, repeated runs, confidence intervals, and transcript inspection from [Automating eval design and hillclimbing with Claude](https://claude.dev/blog/automating-eval-design-and-hillclimbing/). It does not establish full conformity: production representativeness, independent expert agreement, and model-effort scaling remain unproven. No autonomous hillclimbing ran.

[The contributor guide](docs/guides/evaluations.md) explains the frozen inputs, private artifact boundaries, offline validation, preparation reuse, and approved execution scopes. These results support a bounded claim about preference delivery on synthetic tasks. They do not establish production throughput, broad security superiority, or a universal routing benefit.
