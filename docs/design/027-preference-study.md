# Preference study

## Problem

Earlier evaluations could not separate their arms. The deep-learning arm differed from first-time setup by a few generic baseline lines because its learned preferences stayed pending. Criteria came from bundled generic skills, so the bare model already met them and every arm reached the same ceiling. The workspace had no Git history, documentation, or pull request flow, and the executor told candidates not to commit. Scoring ran before anyone checked that the arms differed or that bare could fail a check.

## Decision

Add one protocol, `preference-study-v1`, in `src/eval/native/study/`. It replaces every earlier evaluation protocol.

Score every arm against one frozen preference key. Each key item is observable, differs from default model behavior, and records its provenance:

| Group | Source |
| --- | --- |
| Personal | Rules in the original skill library and instructions |
| Wizard | Observable behavior of the scripted wizard build |
| Learned | Preferences evidenced in consented sessions by at least two corrections or one explicit standing instruction, extracted before deep learning runs |
| Resolved | The side chosen for each pending deep-learning proposal under a rule fixed in advance |

Key items never come from the deep arm's skill text. No key item needed the resolved group in the first two runs.

The arms are bare, original, first-time setup with the scripted build, and deep. The deep arm migrates the existing learned profile into skills, repeats first-time setup, and runs deep learning until no episode remains. The product builds each arm in an isolated home.

Tasks resemble ordinary requests: a terse opening turn and short follow-ups, sent verbatim without an evaluation preamble. The synthetic workspace has modules near the file-length limit, tests, release notes, Git history on a ticketed branch, a local bare remote, and an offline `gh` stub that records pull request creation. Git writes inside the disposable workspace are observed and scored rather than treated as safety failures.

Checks are deterministic where possible: introduced comments, unsafe type syntax, file length, positional parameters, abbreviated identifiers, test-first and mutation-proof action order, Git writes and commit shape, pull request records, and response length, patterns, and sentence count. Semantic checks use two blinded judgments with calibration examples; disagreement stays unknown. No judged check survived validation in the first two runs.

## Sequence

1. **Arms and coverage.** Build the arms and audit which key items each environment covers, with verbatim quotes checked against the files. Stop if the deep arm covers nothing beyond first-time setup; that result is a learning-publication defect.
2. **Tasks and controls.** Run bare as a negative control and "told" (bare plus the task's key statements) as a positive control, twice per task, before scoring. Keep a check only if told passes both runs and bare fails at least one. A told failure or a not-applicable result repairs the task or scorer. A bare pass on both runs marks default behavior and drops the check. Personal arms do not run in this phase.
3. **Scored run.** Freeze the key, build, resolution rule, tasks, checks, environments, model, CLI version, and product commit by hash. Run four arms, the kept tasks, and three repetitions with bounded concurrency. Resume never changes frozen inputs or reruns completed or unfavorable work.

## Repository registration

The first coverage audit found a product defect. Learned preferences from repository sessions receive organization or repository scope, and only a registered repository can receive them. A fresh installation registered no repository; only profile migration did. Deep learning therefore left those records deferred with no destination, and the deep arm matched first-time setup.

Setup and deep learning now register the working repository when Git-metadata consent and skill maintenance are enabled and the remote identity verifies. Blocked, unknown, and isolated origins stay unregistered. Registration configures the repository skill root and records a reversible environment revision.

## First scored run and fixes

The first scored run left the Shadowclone arms behind the original library on learned preferences. Three product defects explained the losses:

- **Conditions lost.** A conditional correction was published unconditionally: "don't commit unless asked; propose a message for review" became "ask before choosing a commit message", so the agent refused an explicit request to commit.
- **Wrong scope.** Evidence from unresolved origins received global scope because only the model's assessment decided it, and a repository-specific rule reached the global baseline.
- **Wrong precedence.** Nothing stated that the user's guidance outranks bundled workflow skills, and their evidence-heavy reporting lengthened direct answers.

Global scope now also requires wording that is not bound to a repository. The reconciliation prompt keeps the situation a rule applies to. The baseline states that an explicit request takes precedence over learned defaults and that the user's guidance outranks bundled skills. Routing repeats that precedence, and `verify-and-review` no longer applies to answers to questions.

Migrated organization rejections were also parsed after redaction, which corrupted their paths and stopped deep learning. They are now parsed from the stored state and redacted only for prompt text.

The rerun reused the frozen tasks and checks unchanged. Reusing tasks after fixing defects they exposed is a limitation of the rerun.

## Superseded protocols removed

The profile-era transfer and guidance protocols, the four-condition skills protocol, the ten-task native protocol, the setup pilot, and the two-turn canary were removed from the code and the documentation. They measured a delivery path that no longer exists or were replaced by this study, and they shared code with it only through a few helpers. Budget, lock, and hashing helpers moved to `src/eval/shared/`, and the verification sandbox and dependency preparation moved to `src/dispatch/`, which uses them.

Two rules from the removed protocols remain in force. Candidates run in isolated homes with identical initial memory for personal arms, and neither agent runs inside a second sandbox because native sandbox helpers cannot start nested. Unfavorable, interrupted, and unknown results are retained in the receipt and never rerun.

## Activation

A migrated environment stays in preparation until every applicable learning is published or dispositioned, and only an active environment publishes native routing. The deep arm resolves pending changes, excludes the learnings that conflict with the evaluation policy or another source with a recorded reason, and activates. Without activation the baseline skill was never routed: Codex still found skills by description, while Claude did not load the baseline.

Preparation must run outside every repository, and it fails if a registered repository sits outside the study directory, because scopes registered from the working directory would publish into it.

## Claude repeat

The same frozen suite runs on Claude Code with Sonnet 5.5 at high effort and with Opus 5.5 at medium effort. Opus 5.5 required a newer Claude Code than the installed one, so it ran from a privately installed copy placed first on the path. Tasks, checks, and analysis do not change. Claude reads `CLAUDE.md` rather than `AGENTS.md`, so every Claude arm gets a `CLAUDE.md` that imports the shared repository instructions.

The learned environments are reused; no new learning runs. Bare and told controls run on Claude and are reported without dropping any check, so the report shows which checks were already default Claude behavior. Codex and Claude use different models and effort, so the two runs compare a setup's effect within each engine, not the engines.

## Scoring across agents

Claude's first scores were understated by the scorer. It piped test runs through `tail`, which hides a failing exit code, and inverted a fix inside one script. Its response text also joined every assistant message. Sessions now record each `bun test` result from the command output, split a script into its test runs and edits, and score an answer as the final message. The inversion proof needs an inverted fix, a failing run, a restored fix, and a passing run, without a passing run before the inversion. The tasks that depend on these checks reran on all three agents, and the rest kept their earlier sessions.

## Per-agent validation and scorer repair

**Problem.** The Claude repeat reused the suite validated on Codex and reported the Claude controls without dropping checks. Opus passed five of ten checks when told, so no setup could score above about half. The scorer also charged Claude for behavior unrelated to the preferences under test.

**Scorer repairs.** Agent attribution, meaning `Co-Authored-By` trailers and "Generated with" lines, is ignored by commit and pull request checks. A test written through a shell heredoc, `tee`, or redirect counts as a test edit, and the test pattern matches the written path instead of the whole command. Heredoc bodies are removed before a command is split into steps.

**Per-agent suites.** Each agent and model validates its own suite from one candidate pool. Bare and told controls run twice per task, and a check stays only if told passes both runs and bare fails at least one. Dropped checks and their reasons are recorded in each suite and listed in each report. Suites are compared within an agent, never across agents.

**Candidate pool.** The pool is the ten candidate tasks with deterministic checks only. Attribution and judged checks are excluded. Word caps are 100 words, about six sentences, instead of the 60 that was fitted to Codex output. The earlier Codex result keeps its 60-word suite.

**Infrastructure failures.** A session that ends in an infrastructure error before the agent acts, such as a sandbox mount failure, a usage limit, or an unrecognized model, has no outcome. It is replaced once, in controls or scoring, and the failed record is kept beside the receipt. Any session with an agent action keeps its result and is never rerun. A usage limit pauses the study until it resets, and no paid overflow or model substitution is used.

**Runs.** Sonnet 5.5 at high effort, Opus 5.5 at medium effort, and GPT-6 Luna at high effort each ran controls, froze their checks, and ran three repetitions of four setups. The prepared environments were reused. GPT-6 Sol keeps its original suite, rescored with the repaired scorer, which changed no verdict.

**Outcome.** Bare Sonnet 5.5, Opus 5.5, and GPT-6 Luna already met 14, 13, and 18 of the 25 candidate checks by default, so the second view keeps 7, 8, and 6 checks on four tasks each. Sessions on tasks with no achievable check are not reported.

## Honest baseline and noise

**Problem.** Keeping a check only when bare fails it forces the baseline near zero and inflates every gain. It also encodes one agent's failure fingerprint instead of the preferences the user holds. Guidance on automated eval design for coding agents makes the same point: do not choose cases because today's model fails them, and measure noise before trusting a gain.

**Decision.** Controls still decide whether a check is achievable. A check that told fails twice, or that never applies, is dropped. The achievable view keeps every other check, including those bare already meets, and is the headline. The earlier view keeps only checks bare fails, and stays as a second view of preferences an agent misses by default.

**Disclosure.** This change followed the first scored results and their reading. Both views are reported so neither can be picked afterward. Sessions did not change. Deterministic checks are rescored from stored records against every candidate check.

**Noise.** Intervals resample tasks and then sessions within each task, so run-to-run variation widens them. Reports carry an interval for each setup's rate and the half-width of each comparison, which is the smallest gain the design separates from noise.

**Deferred.** Hillclimbing Shadowclone against a train and test split of tasks, and an automatic transcript-audit page, need fresh held-out tasks and product changes. They are separate work.

## Reporting

Setups carry plain names in every user-facing page: without Shadowclone or user skills, with user skills, with Shadowclone skills, and with Shadowclone skills and deep learning. The code and report files keep the names bare, original, first-time, and deep.

A check is kept only when bare failed it in controls, so baseline rates sit near zero and a percentage of them says little. Reports give the checks followed out of the checks run for each task and setup, and how many times as many a setup followed as the baseline. The multiple stays empty when the baseline followed none. Bootstrap intervals remain the test of a difference. The `report` phase emits the frozen view and, given the candidate suite, the achievable view.

## Interpretation

The headline metric is task-weighted adherence to the full key. A fidelity metric restricts each arm to the key items its environment covers. The pre-registered hypotheses are deep over bare, deep over original, and first-time over bare, each with and without the resolved group. A hypothesis holds only when the 95% task-cluster bootstrap interval of the paired difference excludes zero. Reports break results down by key group, skill delivery, and adherence with and without a read of the covering skill. Hidden-acceptance correctness and safety remain guardrails.

## Data handling

Suites, keys, fixtures, environments, and receipts stay in a private directory outside every checkout. Key extraction keeps counts, not session text. Learning reads consented sessions through the normal redacted learning path. Candidate Git writes are limited to the disposable workspace and its local remote; the network remains disabled.

## Verification

Synthetic tests cover each check kind, action-order rules, two-turn resume, control keep and drop rules, report arithmetic, workspace Git and stub setup, repository registration, and the scope guard. A real smoke run confirms Git and stub permissions under each agent's sandbox, session resume, skill-read detection, and read-only advice workspaces before controls or scoring run.
