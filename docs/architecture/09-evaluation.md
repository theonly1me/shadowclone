# Evaluation

Evaluation compares how guidance changes an agent's behavior on the same tasks. Preference adherence, correctness, and execution safety are separate results. A completed comparison can show a tie or a loss. [Published results](../../README.md#evaluations) describe the early measurements and their limits.

## Skills environment protocol

`shadowclone eval --protocol guidance-skills-v1` compares the original library saved before migration with the maintained environment:

| Condition | Inputs |
| --- | --- |
| Bare | Task and repository-native guidance |
| Original Skills | Bare plus the original personal instructions and skill library |
| Original Skills + Memory | Original Skills plus frozen native memory |
| Maintained Skills | Bare plus maintained skills and native routing |

The maintained condition receives no compiled profile or separate reference store. Both libraries retain supporting files; routing points into the isolated snapshot. Native memory is frozen with hashes and remains read-only. Skill selection and successful reading are measured separately from adherence and correctness.

Choose reviewed cases before running. Use a repository whose code and guidance you are authorized to send to the selected provider. Required arguments include `--repo`, `--model`, `--reasoning-effort medium`, `--max-budget-usd`, `--max-calls`, `--deadline-seconds`, and `--yes`.

Choose one source of work:

- `--scenario-file <path>` prepares reviewed cases; `--memory-source <path>` can select their memory input.
- `--suite-id <id>` reuses frozen tasks and sources.
- `--eval-id <id>` resumes saved work with its original settings and limits.

Claude requires a supported `claude-sonnet-5` model ID and a local schema-contract preflight. Codex uses `--engine codex --model gpt-6-luna` and supports fresh, frozen, and ordinary resumed skills evaluations. The resolved model must match the requested model. A `--pilot` run has a maximum $5 ceiling; pilots do not establish general superiority.

## Isolation and evidence

Preparation freezes the repository's committed HEAD. Uncommitted work is excluded and reported by count. Preflight rejects unsafe archive entries, escaping or broken links, and submodules before a candidate runs. Each condition gets an independent disposable snapshot with the same task, model settings, and execution constraints.

Remove native Shadowclone injections before constructing each condition. Disable ambient hooks and MCP access, and block live personal guidance and the real repository. Candidate writes are confined to the snapshot, with Git metadata protected. Check HEAD, refs, and local configuration for unauthorized changes.

Evaluation does not install dependencies, run install scripts, or launch the repository-wide test graph. Guidance protocols that support execution run changed focused tests in a restricted local sandbox with network and home access denied. Invalid test paths or linked runtime directories fail verification. Report pass, fail, or not-verified independently of preference scores.

Save diffs, changed-file contents, action metadata, and advice responses before judging. Generated code is unredacted evidence and remains private. Missing, oversized, or truncated evidence cannot pass. Count a reference read only after its successful tool result; an attempted read or a mentioned skill name is insufficient. Shell reads are not currently credited.

## Judging and interpretation

Freeze visible completion requirements and source-backed criteria before candidate execution. Keep judge-only source evidence separate from candidate prompts. Exact syntax constraints use deterministic checks; other guidance criteria use two blinded judgments. Disagreements remain unresolved. Workflow compliance does not by itself prove technical validity or runtime correctness.

Reports distinguish task completion, preferences, memory accuracy, relevant skill reads, timing, and safety. Unknown or unfinished work stays ungraded. Favorable preference scores do not cancel correctness or safety regressions. Native-loader compatibility requires separate delivery probes because supplying frozen context explicitly does not test discovery.

Small samples, overlapping criteria, stale baseline guidance, and model-judge errors limit interpretation. Multiple votes can repeat the same mistake. Successful publication or migration is not evidence that the maintained environment improves behavior.

## Persistence and budgets

Private suites live under `~/.shadowclone/eval-suites/`. Guidance receipts, reduced reports, and durable budgets live under `~/.shadowclone/eval/<evalId>/` as `guidance-state.json`, `guidance-report.json`, and `budget.json`.

Persist candidates and validated votes as they finish. Resume retries only missing work and verifies frozen sources, engine, model, judge contract, and original limits. It does not reset spend or renew a deadline. Unknown cost, exhausted limits, model mismatch, and safety failures stop execution. Unfavorable scores do not trigger automatic reruns.

Reduced reports omit task prompts, private guidance, and code evidence. Review summaries before publishing them; raw receipts and transcripts stay outside public checkouts. [Data handling](../data-handling.md) covers provider access and local storage.

## Historical protocols

Existing receipts keep their original interpretation. Do not use their profile-based results as evidence about the skills environment.

| Protocol | Comparison |
| --- | --- |
| Transfer, the original `shadowclone eval` | Bare repository guidance; added personal context including available memory; that context plus a compiled profile |
| `guidance-v1` | Bare, personal Skills, Skills + verified memory snapshot, Skills + profile and references |
| `guidance-v2` | The guidance comparison using a 4 KiB startup index, current memory snapshots, and restricted focused-test execution |

Transfer tasks can come from `--task`, `--task-file`, generated `--tasks`, or a frozen `--suite-id`. Its default is three tasks and two repetitions. Generated tasks add bounded modules and tests without changing project wiring. Its versioned rubric covers 17 coding-preference categories, with three votes per criterion in batches of at most eight. Correctness is model review, without executing the candidate tests. The decision-grade label requires three tasks, two repetitions, and six scored pairs; it does not establish statistical significance.

`guidance-v1` requires a memory migration manifest when preparing scenarios and checks source hashes. `guidance-v2` freezes current memory directly. Neither modifies live memory. The [guidance design record](../design/021-guidance-evaluation.md) preserves the experiment methods and results. [Compatibility options](../evaluation-compatibility.md) document linked historical runs and recovery.
