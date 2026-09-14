# Transfer evaluation

Transfer evaluation measures how additional personal guidance changes an existing coding agent's adherence to the user's preferences. Correctness and execution safety are reported separately. A completed evaluation may show a tie or a profile loss.

It does not test native instruction discovery. Native delivery has separate path, hook, ownership, and payload tests. Evaluation disables native Shadowclone discovery and supplies a frozen environment explicitly. The [evaluation report](../../evals.md) contains the early results and their limitations.

## Fresh tasks on current HEAD

`shadowclone eval` resolves the repository's current committed HEAD. Uncommitted files are excluded from every snapshot and reported by count. A profile does not need to predate the task, and no historical transcript or starting commit is required.

The command supports three task sources:

- `--task <prompt>` keeps one supplied implementation prompt verbatim and derives separate completion checks.
- `--tasks <number>` generates that many distinct, bounded implementation tasks after read-only repository inspection. The default is three.
- `--suite-id <id>` loads previously frozen tasks, context, profile, and HEAD for a matched comparison with another engine.

Generated tasks add a self-contained module or function and focused tests through new files in an existing package or workspace. They require no changes to existing tracked files or project wiring. Preparation rejects read-only work and tasks requiring commits, pushes, deployments, migrations, credentials, external services, network access, dependency installation, or writes outside the repository.

Preference criteria come from a deterministic, versioned code-only rubric, not the task-generation model. The compiler matches supported rule categories against frozen source quotations, excludes workflow prose and duplicates, and records an identifier, fingerprint, scope, and task-override rule for each criterion. The current catalog recognizes seventeen categories; it is not a general compiler for every possible preference. A required public signature overrides a signature preference only for that API. Internal helpers remain in scope.

## Preflight and execution boundary

Before task generation or coding-agent calls, `preflightRepository` proves that the committed HEAD can be isolated as a clean disposable snapshot. Evaluation does not copy or require the repository's installed dependencies.

Evaluation never invokes a package installer, runs install scripts, downloads dependencies, or executes the repository-wide test, typecheck, lint, build, or Nx affected graph. `--dependency-mode current` remains accepted only as a deprecated compatibility flag and has no dependency-tree behavior.

The coding prompt permits focused inspection and implementation inside the snapshot. It prohibits permanent Git operations, dependency installation, network access, external services, external writes, and broad repository checks. The code change is reviewed directly, so an unrelated repository project cannot dominate or block the measurement.

## Matched execution

Every task and repetition produces three matched implementations:

| Arm | Inputs |
| --- | --- |
| Bare | Task and repository-native guidance |
| Skills | Bare inputs plus consented frozen personal instructions, skills, and memory |
| Clone | Skills inputs plus the current compiled Shadowclone profile |

All arms use independent clones of the same current-HEAD template, with the same engine, model, reasoning effort, timeout, completion requirements, and preference rubric. They run concurrently and persist their outcomes. The default is two repetitions. Skills versus Bare measures the context-library addition; Clone versus Skills measures the profile addition.

Native Shadowclone instruction sections, integration skills, hooks, maintained repository-skill additions, and generated repository companions are removed before the arms start. Existing authored repository guidance remains available to all arms. Consented personal context is identical for Skills and Clone. An unrecognized Shadowclone injection fails isolation instead of contaminating Bare.

The coding prompt explicitly forbids commits, amendments, Git ref or configuration changes, dependency installation, network access, external services, and writes outside the snapshot. The engine receives write access only to the disposable snapshot and cannot write `.git`. `readGitIntegrity` records HEAD, refs, and local configuration before the run; `compareGitIntegrity` turns any change into a binary safety failure.

## Evidence and binary grading

`observeRun` records changed-file contents, the repository diff, changed paths, and action summary without redacting generated code. This preserves code semantics for review and means the evidence is private. The frozen personal context directory is excluded from collected files. Deterministic checks require a real code change and the complete change to fit inside the grading limit. Missing, oversized, incomplete, or truncated evidence cannot pass.

Shadowclone persists the evidence phase before model judging. If judging fails, `--eval-id <id>` resumes from persisted evidence and does not rerun the coding agent.

Each anonymous candidate is judged independently, with three votes for every criterion. Correctness and preference requests are separate, and each preference batch contains at most eight criteria. Additional batches carry all remaining criteria; none are dropped to meet the request limit. A majority determines each pass or fail. These are separate model calls, not necessarily different models.

The judge applies exact source rules to changed code and tests. Version 2 clarifies that PascalCase type names and human-readable error messages are valid under the identifier-case rule. Each validated batch is saved immediately. Missing, duplicated, unknown, or malformed checks invalidate the response; they do not become zero scores. A batch can retry twice after its first attempt. Exhausted retries are a judging infrastructure failure.

Review considers only the frozen requirements and bounded code evidence. It does not prove that every requested behavior works or that tests pass. The known limitations of the early correctness and test-setup verdicts are documented in the public report.

## Progress and recovery

The CLI prints elapsed preparation steps, then task, repetition, arm, execution stage, and judge-vote progress. Versioned receipts store code evidence, completed vote batches, pending judging work, and stage-specific failures. Bounded redacted attempt diagnostics include elapsed time, completion state, and available errors, not credentials or raw private transcripts.

`--eval-id <id>` reuses saved code and completed votes, retrying only missing judging work. A recorded judging failure does not force a coding rerun. The outer deadline persists terminal error state even when an inner model call does not settle, and late writes cannot restore a running state. A host process killed before it can write is still an external interruption, not a completed evaluation.

The reported live comparison used process-scoped idle-sleep guards. The harness does not change global power settings or promise that an operating system cannot suspend or terminate it.

## Quantified decision

For each arm, task success is the fraction of completed runs with all correctness, safety, and execution checks passing. Preference adherence is the mean fraction of preference requirements passed per graded run. Incomplete work remains ungraded, never 0%. An incomplete report is not a completed comparison. The report includes:

- all three arms' task-success and preference-adherence percentages;
- library lift for Skills over Bare and profile lift for Clone over Skills;
- relative profile improvement when Skills adherence is nonzero;
- Clone-versus-Skills wins, ties, and losses;
- correctness and safety regressions;
- paired sample size.

Evaluation status is `complete` only when every expected arm finishes. A recorded infrastructure failure produces `error`; unfinished work remains `running`. Profile improvement is reported separately as demonstrated or not demonstrated. Completion never depends on Clone winning, and a favorable preference score never cancels a correctness or safety regression.

A one-task, one-repeat run is a smoke test. The CLI's decision-grade label requires at least three tasks with two repetitions; that threshold alone does not establish statistical significance or judge validity. A matched comparison with another model or provider can reuse a compatible frozen suite. The early four-task report used one implementation per arm per task, so it does not meet that repeated-run threshold.

## Storage and privacy

Frozen suites are stored under `~/.shadowclone/eval-suites/<suiteId>.json`. Receipts are stored under `~/.shadowclone/eval/<evalId>/receipt.json` after evidence and vote checkpoints. Suite loading validates the repository, HEAD, profile fingerprint, task profile fingerprints, rubric version, and schema. Resume additionally validates engine, model, effort, repetition count, timeout, and budget against the original receipt. A changed rubric requires a new evaluation identity. Historical receipts remain unchanged, and unsupported historical schemas are not silently upgraded.

Agent context is read only when `agent-context` consent is enabled and enters the snapshot through `resolveRedacted`. Profile compilation follows the same scoped compiler used by native delivery. Coding agents can read the chosen repository snapshot, and judges receive unredacted code evidence. Only authorized repositories may be used. Judge explanations, diagnostics, and printable JSON pass through deterministic redaction, but redaction is not a publication-safety guarantee.

Publish reviewed summaries of methods, scores, and limitations. Do not publish raw receipts or transcripts as evaluation reports.
