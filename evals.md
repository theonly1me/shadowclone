# Evaluation results

These small studies measure adherence to stated engineering preferences. They do not establish productivity gains or general superiority. Both used the earlier profile-based system; the current [skills environment protocol](docs/architecture/09-evaluation.md#skills-environment-protocol) evaluates maintained skills separately.

## Early profile comparison

GPT-5.6 Sol, at medium reasoning effort, completed four TypeScript tasks in three setups. One implementation per task and setup produced twelve graded implementations, with three judge votes per preference check.

| Setup | Repository guidance | Personal skills and context | Shadowclone profile |
| --- | --- | --- | --- |
| Bare | Yes | No | No |
| Skills | The same | Yes | No |
| Clone | The same | The same as Skills | Yes |

Bare already had useful repository instructions. Skills added existing user-written or user-guided instructions, including frozen personal memory where available. Their freshness was not assessed. Clone added the scoped Markdown profile; it did not change model weights.

All setups used the same task, starting state, model settings, and execution constraints. Native Shadowclone injections were removed from snapshots. Each task required a new self-contained module and focused tests, without changing existing files or project wiring.

| Task | Assignment |
| --- | --- |
| 1. Byte quantities | Parse nonnegative decimal quantities with B, KB, MB, GB, KiB, MiB, and GiB units. Use decimal or binary multipliers as appropriate, reject invalid or unsafe byte counts, and format into a requested unit with zero to three decimal places and trailing zero removal. Test conversions, boundaries, fractions, and invalid input. |
| 2. Integer ranges | Validate half-open safe-integer ranges, normalize unsorted and duplicate ranges, discard empty ranges, merge overlaps and touching ranges, intersect range lists, and check membership. Preserve caller-owned inputs and test boundaries, invalid inputs, and immutability. |
| 3. Ordered query parameters | Parse and serialize query strings using URLSearchParams semantics while preserving order, duplicates, and empty keys or values. Replace a key's values at its first occurrence, append when absent, and remove it for an empty replacement list. Preserve inputs and test encoding, ordering, and round trips. |
| 4. Bounded undo/redo | Implement immutable generic history with a positive safe-integer undo capacity, recording, undo, redo, and availability queries. Trim old history, clear redo on branching, and preserve state and redo for Object.is-equal recordings. Test capacity, identity, no-op behavior, and immutability. |

The byte-quantity pilot was regraded after clarifying that PascalCase types and readable error messages were valid. The other tasks used that clarified rubric. Regrading did not add another implementation or repetition.

### Scoring

A frozen code-only rubric retained each criterion's source quotation, scope, and task exceptions. Its 17 checks covered type safety, options-object arguments, promises, full names, file length, public module boundaries, suppressions, comments, identifier casing, abbreviation casing, all-caps names, generic names, module-local names, feature organization, colocated tests, composition, and test-local setup.

These are one user's preferences. Workflow instructions that could not be judged from code were excluded. A task-required signature overrode a conflicting preference only for that public API.

Anonymous candidates received three model votes per criterion, with a majority result. These were separate calls, not three different models or human reviewers. Requests contained at most eight criteria per batch, and validated batches were saved for recovery. Each pass earned one point; the fixed denominator allowed a rule to pass when the task never exercised the prohibited construct. Some naming checks overlapped.

### Recorded results

| Task | Bare | Skills | Clone |
| --- | ---: | ---: | ---: |
| Byte quantities | 11/17 | 14/17 | 15/17 |
| Integer ranges | 15/17 | 14/17 | 16/17 |
| Ordered query parameters | 15/17 | 16/17 | 16/17 |
| Bounded undo/redo | 14/17 | 15/17 | 15/17 |
| Total | 55/68 (80.9%) | 59/68 (86.8%) | 62/68 (91.2%) |

Clone exceeded Skills on two tasks and tied on two. The aggregate differences were 10.3 percentage points over Bare and 4.4 over Skills. Those are observations from this sample, not expected gains on other work.

The recorded deductions show where guidance helped and where it did not:

| Task | Bare | Skills | Clone |
| --- | --- | --- | --- |
| Byte quantities | Cast, positional arguments, comments, uppercase constants under two rules, redundant module context | Two uppercase-constant checks and redundant module context | Redundant module context and mutable test setup |
| Integer ranges | Positional arguments and redundant module context | The same, plus a forbidden documentation comment | Redundant module context |
| Ordered query parameters | Positional arguments and redundant module context | Redundant module context | Redundant module context |
| Bounded undo/redo | Non-null assertions, positional arguments, redundant module context | Redundant module context and setup after assertions | Redundant module context and reassigned test variables |

### Correctness and judging limits

Model-reviewed correctness scores were 5/5 for Tasks 1, 2, and 4, and 4/5 for Task 3 in every setup. Candidate tests were not executed, and the criteria did not cover every requested behavior.

Task 3's deduction came from a rubric defect: it demanded separate assertions for empty keys and values, although combined assertions satisfied the task. Judges acknowledged that the behavior was preserved. The deduction does not demonstrate a functional failure.

The test-setup rule was also inconsistent in Task 4: Skills lost a point for setup after assertions while similar Bare code passed two votes to one. The recorded scores remain unchanged.

Four tasks with one implementation per setup do not meet the harness's repeated-run threshold. Correlated judge errors, overlapping criteria, and an unoptimized personal-context baseline further limit the result. It does not establish runtime correctness, unrestricted execution safety, or time saved.

## Repository harness pilot (2026-09-26)

Two synthetic repositories in `src/harness/fixtures/` each ran once with existing guidance and once after repository setup. Claude Code used `--model sonnet`, `acceptEdits`, a $1.50 cap per run, and no permission bypass. Both arms received the same task; held-out acceptance tests were added after execution.

Setup was then named `shadowclone harness init`, now `shadowclone init --repo`. The harness arm used a four-rule profile: no TypeScript comments, files under 200 lines, a failing test for new behavior, and no commit.

| Repository | Arm | Held-out acceptance | Gate | Tests added | Agent committed | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Bun task list | baseline | 3 of 3 | pass | yes | no | $0.29 |
| Bun task list | harness | 3 of 3 | pass | yes | no | $0.22 |
| Python config | baseline | pass | pass | no | no | $0.29 |
| Python config | harness | pass | pass | yes | no | $0.22 |

Both arms solved both tasks. The Python baseline skipped a test while the harness arm added one. One run per arm on two small tasks shows that setup carried a working practice in this sample, without establishing a general improvement.

## Further evaluation

The [guidance and memory record](docs/design/021-guidance-evaluation.md#recorded-comparisons) preserves later profile comparisons and their measurement problems. See [evaluation architecture](docs/architecture/09-evaluation.md) for current protocols, isolation, budgets, and recovery.
