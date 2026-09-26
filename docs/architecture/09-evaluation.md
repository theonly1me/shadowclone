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

Snapshot extraction accepts regular tracked files and relative symbolic links only when every link resolves inside the extracted repository. Absolute, escaping, missing, cyclic, and submodule entries fail preflight before an agent runs. This supports repositories that use internal links for shared configuration without allowing archive extraction to reach host files.

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

Native Shadowclone instruction sections, integration skills, hooks, maintained repository-skill additions, and generated repository companions are removed before the arms start. Safe-mode execution disables ambient instruction discovery, so the shared coding prompt explicitly tells every arm to read the checked-in instruction files, rules, and relevant repository skills for its selected agent. Consented personal context is identical for Skills and Clone. An unrecognized Shadowclone injection fails isolation instead of contaminating Bare.

Frozen personal context contains the selected agent's global native catalog only. Claude uses `~/.claude/skills`; Codex uses portable `~/.agents/skills` plus built-in `~/.codex/skills/.system`. Repository skills and instructions remain in the repository snapshot and are not copied into personal context a second time. Identical skill files are deduplicated before prompting.

The coding prompt explicitly forbids commits, amendments, Git ref or configuration changes, dependency installation, network access, external services, and writes outside the snapshot. The engine receives write access only to the disposable snapshot and cannot write `.git`. `readGitIntegrity` records HEAD, refs, and local configuration before the run; `compareGitIntegrity` turns any change into a binary safety failure.

## Evidence and binary grading

`observeRun` records changed-file contents, the repository diff, changed paths, and action summary without redacting generated code. This preserves code semantics for review and means the evidence is private. The frozen personal context directory is excluded from collected files. Deterministic checks require a real code change and the complete change to fit inside the grading limit. Missing, oversized, incomplete, or truncated evidence cannot pass.

Evaluation-only temporary files live under `.eval-runtime` inside a writable Claude snapshot and are excluded from evidence. This keeps runtime caches from appearing as agent-authored changes or consuming the grading limit.

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

Frozen suites are stored under `~/.shadowclone/eval-suites/<suiteId>.json`. Private receipts are stored under `~/.shadowclone/eval/<evalId>/state.json` after evidence and vote checkpoints. `report.json` and `--json` contain reduced results without task prompts, profiles, or code evidence. Suite loading validates the repository, HEAD, profile fingerprint, task profile fingerprints, rubric version, and schema. Resume additionally validates engine, model, effort, repetition count, timeout, and budget against the original receipt. A changed rubric requires a new evaluation identity. Historical receipts remain unchanged, and unsupported historical schemas are not silently upgraded.

Agent context is read only when `agent-context` consent is enabled and enters the snapshot through `materializeSnapshot`, which bounds the read and applies redaction. Profile compilation follows the same scoped compiler used by native delivery. Coding agents can read the chosen repository snapshot, and judges receive unredacted code evidence. Only authorized repositories may be used. Judge explanations and diagnostics pass through deterministic redaction. Printable JSON contains only reduced results.

Publish reviewed summaries of methods, scores, and limitations. Do not publish raw receipts or transcripts as evaluation reports.

## Guidance and memory protocol

`shadowclone eval --protocol guidance-v1` leaves the historical transfer protocol and receipts unchanged. It freezes four reviewed cases with visible completion requirements and at most eight source-backed criteria each. Two cases are code tasks and two are advice tasks. The pilot selects one of each, with one repetition across four conditions. A full run uses all four cases with two repetitions.

| Condition | Inputs |
| --- | --- |
| Bare | Task and repository-native guidance |
| Skills | Bare plus personal instructions and skill catalog |
| Memory | Skills plus an explicitly selected, verified Claude memory snapshot |
| Clone | Skills plus the production Shadowclone bootstrap, profile, and scoped references |

Skill names, descriptions, and frozen paths are visible in every skill-enabled condition; identical skill bodies remain on demand. Memory and references are installed only in their selected conditions. The engine blocks live profiles, native memory, personal skills, and the real repository while allowing the disposable snapshot. Existing snapshot isolation disables ambient hooks and MCP access. The memory source must match the migration manifest's file count and hashes. Live Claude memory is not restored or changed.

Successful Read results are joined to requests to measure relevant skills loaded before editing and reference retrieval. Failed or unanswered reads do not count. Shell-based reads are not currently credited. Preference checks include deterministic syntax rules and two blinded judgments for other criteria. Disagreements remain unknown. Shared-memory and additional-knowledge checks have separate scores. Code is inspected for syntax but never executed; correctness is explicitly unverified and is not folded into preference scores.

Private suites use `eval-suites/<suiteId>.guidance.json`. Receipts and reduced reports use `eval/<evalId>/guidance-state.json` and `guidance-report.json`; the durable `budget.json` records invocations and spend. Resume preserves completed evidence, votes, original model, conditions, call limit, dollar limit, and deadline. Unknown cost, model mismatch, safety failure, or exhausted limits stop the run. There are no automatic retries for unfavorable outcomes.

The CLI requires an exact Sonnet 5 model ID, medium effort, explicit dollar, invocation, and wall-clock limits, and `--yes`. The resolved model must match the requested ID, optionally with a dated suffix, throughout the run. Preparation uses `--scenario-file`, `--memory-source`, and `--memory-manifest`. `--suite-id` reuses frozen sources; `--eval-id` resumes an interrupted receipt. A pilot cannot exceed $5. Increasing to a full evaluation is a separate user decision, with cumulative round spend accounted for before setting its limit.

Memory coverage is audited independently of behavioral scores. Exact rule or reference preservation, reviewed skill coverage, exclusions, and unresolved conflicts are distinct outcomes. A migration disposition alone never establishes parity. The [implementation plan](../design/021-guidance-evaluation.md) defines this round's acceptance and stop conditions.

Judge output uses Draft 7 JSON Schema. Before paid guidance execution, a macOS contract probe runs the installed Claude CLI with synthetic inputs and credentials, personal-file reads blocked, and OS network access limited to a local mock API. It verifies the legacy Draft 2020-12 rejection happens before any messages request and that the current schema reaches the mock. No real model is invoked. The private `claude-contract.json` records CLI version, executable and schema fingerprints, and message counts.

`--recover-preflight-failure --eval-id <id> --failed-cli-version <version>` explicitly recovers only the verified first-judge schema rejection after one saved candidate. The version must match the local contract proof. The immutable `schema-recovery.json` preserves the original receipt and budget, proof, zero-cost reconciliation reason, and one renewed 25-minute deadline. The call count and known spend never reset. Recovery can finish an interrupted write, but repeated recovery cannot extend the deadline again or clear a later unknown cost. Ordinary resume preserves its original deadline, and altered frozen suites or settings are rejected before execution.

### Measurement validation

`--validation-of <completed-pilot-id> --cumulative-budget-usd 10 --max-calls 48 --deadline-seconds 2700 --yes`, with the normal protocol, repository, model, and effort arguments, selects the existing two pilot cases for two repetitions across all four conditions. Do not combine it with `--pilot`, `--max-budget-usd`, or recovery flags. A deterministic child identity makes repeated invocation resume the same validation. The child's ledger subtracts the frozen parent spend from the cumulative ceiling; the original receipt and ledger are never rewritten. Changed parent fingerprints, frozen sources, model, judge contract, or limits block resume. A child's unknown cost remains unknown, and its deadline never renews.

### Maintained-reference comparison

`--maintenance-of <completed-validation-id> --suite-id <maintained-suite-id> --additional-budget-usd 10 --max-calls 48 --deadline-seconds 2700 --yes` creates one separately authorized comparison. Preparation applies only the approved Jest reference path correction through the existing profile lock and revision history, with compare-before-write protection. It derives a frozen suite from the parent without recapturing live inputs. The private maintenance manifest records the verified commit, corrected path, revision ID, source hashes, and suite fingerprints. The 23-rule profile and personal skills do not change.

The maintenance receipt has a deterministic identity tied to its measurement-validation parent. Its optional maintenance metadata includes the original pilot and validation accounting fingerprints, their combined spend and calls, the additional allowance, and the source manifest. Initialization verifies the original accounting chain without double-counting the pilot. Resume requires the same sources, model, judge contract, call limit, additional budget, and window setting, and preserves the actual original deadline. A maintenance receipt cannot parent another maintenance allowance. Existing validation and ordinary evaluation semantics remain unchanged.

Judge version 3 adds two complete frozen historical memory bodies to the original four repository sources. Already-redacted memory is reused without another materialization pass. Repository evidence still enters through materializeSnapshot. Exact snapshot existence checks cover both candidate package directories and both test-file paths. Six neutral source IDs carry hashes and line numbers; provider metadata and private source mapping never enter judge prompts. The combined packet remains capped at 64 KiB and is identical across advice conditions. The private receipt retains provenance. Historical supported verification is distinct from current-session execution, and every recommended runnable command alternative must be valid. Earlier prompt fingerprints and receipts remain unchanged.

New source-grounded comparisons use judge version 4. Its additional instructions distinguish adherence to an explicit workflow from technical validity. A documented command can miss a prescribed command-form preference without being proven nonfunctional. A possible alternative mock strategy does not automatically meet an explicit used-export requirement. Concrete nonexistent paths remain conflicts, and a valid command does not excuse another conflicting runnable alternative. Evidence that cannot settle a criterion yields unknown. The contract does not change criteria or claim runtime verification.

The receipt's source-judge version selects its instructions and fingerprint. Existing version 3 receipts retain their original prompts, votes, budget, and deadline on resume. Version 2 validation and ordinary evaluation behavior remain unchanged. No historical receipt is upgraded or regraded automatically. Offline fixtures verify delivery and resume contracts only; they do not establish model judgment accuracy. A broader paid comparison still requires its own approved scope and accounting baseline.

### Four-case comparison

`--comparison-of <completed-maintenance-id> --additional-budget-usd 20 --max-calls 96 --deadline-seconds 5400 --yes` runs all four frozen cases twice across the same four conditions. The model must be exactly claude-sonnet-5 with medium effort. It requires a completed maintenance parent and verifies that parent's accounting against the original pilot and measurement validation before deriving cumulative spend and calls. The parent suite and already-redacted source packet are reused unchanged. Only the new receipt uses judge version 4; the parent is not upgraded or regraded.

The child identity is deterministic from the maintenance parent and comparison protocol. Its optional comparison metadata freezes parent receipt and budget fingerprints, prior spend and calls, additional allowance, and window length. The receipt cannot parent another comparison allowance. Changed inputs, judge contract, model, or limits block resume. New initialization validates snapshot extraction and both installed-Claude mock contracts before starting the paid deadline. Candidates and individual votes persist through the existing runner. Resumes retain all saved work, spend, call counts, and the original deadline. Unknown cost, exhaustion, model mismatch, missing evidence, or isolation failure stops execution without retry or deadline renewal.

This comparison uses maintained Shadowclone references against historical Claude memory. Its known cases are diagnostic, not held-out validation. It cannot establish autonomous repair, equal-fact superiority, complete memory parity, or additional-learning value. Two independent votes remain required and disagreements stay unresolved. New reports label Skills + Claude memory and Skills + Shadowclone explicitly; unexecuted tests remain unverified.

Measurement version 2 stores normalized relative paths, tool categories, success, and request/result sequence positions. Canonical paths prevent macOS aliases from losing reads. Read completion must precede a successful mutation request to establish before-edit delivery. Failed writes are not edits. Unclassified shell activity makes otherwise uncertain timing null. No command bodies, tool outputs, or transcript copies are stored. Reports label historical traces unreliable and never interpret absent observations as proof of non-use.

Validation freezes four additional judge-only repository sources from the original commit, named in the private scenario. `captureJudgePacket` uses `materializeSnapshot` as its single redaction boundary before storing or sending this source text. A line-numbered, content-hashed packet is limited to 64 KiB and shared identically with advice judges. It does not enter candidate prompts. The receipt fingerprints the packet and revised judge instructions. Missing corroboration cannot alone establish fabrication; failures require a concrete criterion-relevant conflict. Existing criteria and historical votes are unchanged.

The real-CLI stream contract uses scripted synthetic API responses and file tools under OS-level loopback-only networking, with personal-file reads denied. It verifies successful and failed reads around a successful file write. The ordinary unit suite skips these installed-CLI tests unless `SHADOWCLONE_CLAUDE_CONTRACT=1` is explicit.
