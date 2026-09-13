# Transfer evaluation

Transfer evaluation asks one product question: does the frozen portable agent environment make an existing coding agent more successful at following the user's engineering preferences without reducing correctness or safety?

It does not test native instruction discovery. Native delivery has separate path, hook, ownership, and payload tests. Evaluation disables native Shadowclone discovery and gives the frozen personal environment only to the clone arm.

## Fresh tasks on current HEAD

`shadowclone eval` resolves the repository's current committed HEAD. Uncommitted files are excluded from every snapshot and reported by count. A profile does not need to predate the task, and no historical transcript or starting commit is required.

The command supports three task sources:

- `--task <prompt>` keeps one supplied implementation prompt verbatim and derives its completion and preference checks.
- `--tasks <number>` generates that many distinct, bounded implementation tasks after read-only repository inspection. The default is three.
- `--suite-id <id>` loads previously frozen tasks, context, profile, and HEAD for a matched comparison with another engine.

Generated tasks add a self-contained module or function and focused tests through new files in an existing package or workspace. They require no changes to existing tracked files or project wiring. Preparation rejects read-only work and tasks requiring commits, pushes, deployments, migrations, credentials, external services, network access, dependency installation, or writes outside the repository. It selects two to five applicable engineering requirements from the frozen personal environment without including them in the task prompt.

## Preflight and execution boundary

Before task generation or coding-agent calls, `preflightRepository` proves that the committed HEAD can be isolated as a clean disposable snapshot. Evaluation does not copy or require the repository's installed dependencies.

Evaluation never invokes a package installer, runs install scripts, downloads dependencies, or executes the repository-wide test, typecheck, lint, build, or Nx affected graph. `--dependency-mode current` remains accepted only as a deprecated compatibility flag and has no dependency-tree behavior.

The coding prompt permits focused inspection and implementation inside the snapshot. It prohibits permanent Git operations, dependency installation, network access, external services, external writes, and broad repository checks. The code change is reviewed directly, so an unrelated repository project cannot dominate or block the measurement.

## Matched execution

Every task and repetition produces a matched pair:

1. The baseline receives the task and repository-native guidance from the clean snapshot.
2. The clone receives the same inputs plus frozen personal instructions, selected skills, memory, and the current compiled profile.

Both arms use independent clones of the same current-HEAD template, with the same engine, model, reasoning effort, timeout, completion requirements, and preference requirements. They run concurrently, then the receipt records both outcomes together. The default is two repetitions.

Native Shadowclone instruction sections, integration skills, hooks, maintained repository-skill additions, and generated repository companions are removed from the snapshot before either arm starts. Existing authored repository guidance remains available to both arms. Personal maintained skills and generated companions are frozen through the consented context source and enter only the clone. An unrecognized Shadowclone injection fails isolation instead of contaminating the baseline.

The coding prompt explicitly forbids commits, amendments, Git ref or configuration changes, dependency installation, network access, external services, and writes outside the snapshot. The engine receives write access only to the disposable snapshot and cannot write `.git`. `readGitIntegrity` records HEAD, refs, and local configuration before the run; `compareGitIntegrity` turns any change into a binary safety failure.

## Evidence and binary grading

`observeRun` records redacted changed-file contents, the repository diff, changed paths, and action summary. Deterministic checks require a real code change and the complete change to fit inside the grading limit. Missing, oversized, incomplete, or truncated evidence cannot pass.

Shadowclone persists the evidence phase before model judging. If judging fails, `--eval-id <id>` resumes from persisted evidence and does not rerun the coding agent.

Three concurrent blind structured code-review votes receive both anonymous candidates and grade every completion and preference requirement independently as `pass` or `fail`. Review considers behavior, edge cases, types, API design, and test quality directly from the bounded change. The middle vote reverses candidate order. Each vote can retry malformed structured output twice. A majority determines the final check. A missing check is a failure; malformed output after retries is an infrastructure error, not an unknown product outcome.

## Progress and recovery

The CLI prints elapsed preparation steps, then task, repetition, arm, execution stage, and judge-vote progress. The current stage is persisted in the receipt, so another process can inspect a long run without waiting for a coding or judging call to finish. Evidence is saved before judging. `--eval-id <id>` resumes saved evidence without repeating completed coding work.

## Quantified decision

For each arm, task success is the fraction of completed runs with all correctness, safety, and execution checks passing. Preference adherence is the mean fraction of preference requirements passed per run. The report includes:

- baseline and clone task-success percentages;
- baseline and clone preference-adherence percentages;
- adherence lift in percentage points;
- relative improvement when baseline adherence is nonzero;
- paired wins, ties, and losses;
- correctness and safety regressions;
- paired sample size.

The evaluation returns `PASS` only when every expected pair is present, preference-adherence lift is positive, clone task success is nonzero and no worse than baseline, and there are no correctness or safety regressions. Any complete comparison that misses those conditions returns `FAIL`. A process, isolation, evidence, or judging failure returns `ERROR` with a resumable evaluation id.

A one-task, one-repeat run is a smoke test and is explicitly labeled as not decision-grade. The standard decision run uses three tasks with two repetitions. A second provider comparison reuses the first run's suite id so task selection cannot favor either engine.

## Storage and privacy

Frozen suites are stored under `~/.shadowclone/eval-suites/<suiteId>.json`. Receipts are stored under `~/.shadowclone/eval/<evalId>/receipt.json` after each evidence and grading step. Suite loading validates the repository, HEAD, profile fingerprint, task profile fingerprints, and schema. Resume additionally validates engine, model, effort, repetition count, timeout, and budget against the original receipt.

Agent context is read only when `agent-context` consent is enabled and enters the snapshot through `resolveRedacted`. Profile compilation follows the same scoped compiler used by native delivery and other consumers. Changed files, diffs, actions, judge evidence, failures, and printable JSON pass through deterministic redaction. Tasks, context, evidence, and receipts remain private local artifacts. Published results contain only aggregate metrics and sample size, never engine, model, repository, task, prompt, diff, or receipt contents.
