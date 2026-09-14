# Early preference evaluation

This comparison asks whether adding a Shadowclone profile helps a coding agent follow a user's engineering preferences. It measures adherence to stated guidance, not speed, general intelligence, or productivity.

Four small TypeScript tasks were completed across three setups using GPT-5.6 Sol with medium reasoning effort. There was one implementation per task per setup, giving twelve graded implementations. Every preference check has three judge votes.

## What each agent received

| Setup | Repository guidance | Personal skills and context | Shadowclone profile |
| --- | --- | --- | --- |
| Bare | Yes | No | No |
| Skills | The same | Yes | No |
| Clone | The same | The same as Skills | Yes |

Bare is a repository-native baseline, not an agent with no instructions. The repository's existing guidance can overlap with the preferences being measured.

The personal skills were existing user-written or user-guided instructions. They were not a benchmark-specific library or an independently optimized baseline. Such instructions can become outdated or inconsistent; this comparison did not assess their freshness. They covered coding conventions and task workflows. The Skills setup also admits frozen personal instructions and memory when available, so Skills versus Bare measures the personal context package, not skills alone.

Clone received that same frozen personal context plus the scoped Markdown profile compiled by Shadowclone. The profile provides additional guidance learned or recorded through Shadowclone; it does not change the model's weights. Skills versus Clone is the comparison that isolates the added profile within this setup.

Native Shadowclone injection was removed from the repository snapshots to keep the setups separate. All three agents received the same task, starting repository state, model settings, and execution constraints. They could choose their public APIs, names, and file organization.

## Tasks

All tasks required a self-contained new module and focused tests, with no changes to existing files or project wiring.

| Task | Assignment |
| --- | --- |
| 1. Byte quantities | Parse nonnegative decimal quantities with B, KB, MB, GB, KiB, MiB, and GiB units. Use decimal or binary multipliers as appropriate, reject invalid or unsafe byte counts, and format into a requested unit with zero to three decimal places and trailing zero removal. Test conversions, boundaries, fractions, and invalid input. |
| 2. Integer ranges | Validate half-open safe-integer ranges, normalize unsorted and duplicate ranges, discard empty ranges, merge overlaps and touching ranges, intersect range lists, and check membership. Preserve caller-owned inputs and test boundaries, invalid inputs, and immutability. |
| 3. Ordered query parameters | Parse and serialize query strings using URLSearchParams semantics while preserving order, duplicates, and empty keys or values. Replace a key's values at its first occurrence, append when absent, and remove it for an empty replacement list. Preserve inputs and test encoding, ordering, and round trips. |
| 4. Bounded undo/redo | Implement immutable generic history with a positive safe-integer undo capacity, recording, undo, redo, and availability queries. Trim old history, clear redo on branching, and preserve state and redo for Object.is-equal recordings. Test capacity, identity, no-op behavior, and immutability. |

Task 1 was the pilot. Its saved implementations were regraded after clarifying that PascalCase types and human-readable messages are valid. Tasks 2 through 4 then ran with that clarified rubric. The pilot regrade is not counted as another implementation or repetition.

## How preference scoring worked

A versioned code-only rubric was frozen before execution. Each criterion retained a stable identifier, its source quotation, scope, and any explicit task exception. The same rubric was applied to every setup. Workflow instructions that could not be judged from the generated code were excluded.

This rubric contained seventeen checks: type safety, options-object arguments, promise handling, complete names, file length, public module boundaries, lint suppressions, zero comments, identifier casing, abbreviation casing, all-caps names, generic parameter names, module-local names, feature-based organization, colocated tests, composition, and test-local setup.

These are the user's preferences, not universal definitions of good code. A task-required API signature overrides a conflicting preference for that API only. PascalCase type names and readable error messages do not violate the identifier-case check.

Each anonymous implementation was graded separately. Three independent model votes judged each criterion as pass or fail; the majority determined its score. Preference requests contained at most eight criteria per batch. Validated batches were saved immediately so unfinished judging could resume without regenerating code. These are independent votes, not three different judge models or human reviewers.

Each passing criterion contributes one point. A score of 15/17 means fifteen guideline checks passed. The denominator is fixed here: a rule can pass because the code avoids the prohibited construct, even if the task did not actively exercise that rule. Related rules can overlap, such as camelCase identifiers and avoiding all-caps names.

## Recorded preference results

| Task | Bare | Skills | Clone |
| --- | ---: | ---: | ---: |
| 1. Byte quantities | 11/17 | 14/17 | 15/17 |
| 2. Integer ranges | 15/17 | 14/17 | 16/17 |
| 3. Ordered query parameters | 15/17 | 16/17 | 16/17 |
| 4. Bounded undo/redo | 14/17 | 15/17 | 15/17 |
| Total | 55/68 (80.9%) | 59/68 (86.8%) | 62/68 (91.2%) |

Clone scored above Bare on all four tasks. It scored above Skills on two tasks and tied on two. The aggregate difference was 10.3 percentage points over Bare and 4.4 over Skills. These differences describe this small comparison, not an expected gain on other work.

### Judges' reasons

These summaries explain the recorded verdicts; they are not additional grading.

| Task | Bare | Skills | Clone |
| --- | --- | --- | --- |
| Byte quantities | Lost checks for a prohibited cast, positional arguments, comments, uppercase constants under two naming rules, and names repeating the module context. | Used options objects and avoided prohibited casts and comments. Lost two naming checks for an uppercase constant and one for redundant module context. | Passed the corrected casing rule. Lost checks for redundant module context and mutable test setup. |
| Integer ranges | Lost checks for positional arguments and redundant module context. | Had the same two failures plus a forbidden documentation comment. | Used options objects and no comments. Lost only the module-local naming check. |
| Ordered query parameters | Lost checks for positional replacement arguments and redundant module context. | Used an options object. Lost only the module-local naming check. | Used an options object. Lost only the module-local naming check. |
| Bounded undo/redo | Lost checks for non-null assertions, positional arguments, and redundant module context. | Avoided the first two violations. Lost checks for redundant module context and setup placed after assertions. | Avoided non-null assertions and positional arguments. Lost checks for redundant module context and reassigned test variables. |

Skills scored below Bare on the integer-range task because it added a comment that violated the zero-comments rule. Extra guidance did not guarantee better adherence. All setups lost the module-local naming check somewhere in each task.

## Correctness is separate

The model-scored correctness checks were identical across setups: 5/5 for Tasks 1, 2, and 4, and 4/5 for Task 3. They are code-review judgments, not proof from executing a complete test suite. The evaluation did not install dependencies or run repository-wide checks, and the selected correctness criteria do not cover every requested behavior.

Task 3's deduction exposes a correctness-rubric defect: it required separate assertions for empty keys and empty values even though the task did not. All three implementations covered both in combined assertions, and the judges acknowledged that the behavior was preserved. That deduction is not evidence of a functional failure.

## Limits and unresolved judging issues

- Four tasks, one implementation per setup, and one model configuration are too small to establish general superiority. This does not meet the harness's repeated-run threshold of three tasks with two repetitions.
- The test-setup rule was applied inconsistently in Task 4. Skills lost a point for setup after assertions, while similar Bare code passed by a two-to-one vote. The recorded scores have not been silently corrected.
- Model judges can make correlated mistakes. Three votes improve inspectability but do not replace human review or executable checks.
- Bare had useful repository guidance, and some checks were easy for every setup to pass. Skills may be stale; the comparison does not show what a carefully revised skill library would achieve.
- The results show preference adherence under this rubric. They do not establish correctness, safety in unrestricted execution, time saved, or better performance across users, repositories, providers, and task sizes.

## Run your own comparison

Use the evaluation harness with a repository you are authorized to evaluate and your own consented guidance. See [the evaluation architecture](docs/architecture/09-evaluation.md) for setup, isolation, persistence, and recovery, and [the judging design record](docs/design/020-preference-judging.md) for the measurement changes.
