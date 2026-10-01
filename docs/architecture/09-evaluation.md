# Evaluation

The [fixed preference benchmark](../guides/fixed-evals.md) uses committed synthetic tasks, a handwritten target profile, existing skills, and independently authored correction sessions. `preference-respect-v2` compares bare, existing skills, the unchanged library plus Shadowclone routing, and routing plus actual deep learning. Routing preparation disables learning; the deep environment starts identically and then uses production capture, redaction, extraction, review, and publication. Its bounded learner calls and output are frozen once for both hosts. No personal installation or real history is imported.

The headline is the share of applicable preference checks followed, with equal task weights and partial credit. Correctness, safety, and whole-task success are separate results. Every task and check remains in the denominator. Missing cells and unconfirmed model identities leave the report incomplete. Reports include actual preparation provenance and support matched product-revision comparisons. Private evidence stays outside every checkout. These public development tasks do not establish held-out performance.

`preference-respect-v1` remains a separate delivery experiment comparing bare instructions, the full direct profile, and the same profile as maintained skills. It requires no learning and retains its three-setup reports and whole-task scoring. Its results cannot supply the new four-setup headline.

The workflow outcome protocol records frozen tasks and reported acceptance, human review effort, corrections, regressions, interventions, and cost. It does not run model tasks. Outcome recording and preference adherence on this small fixed benchmark do not independently establish broad learning quality.

## Historical learning study

The preference study compares how agents follow one anonymized participant's engineering preferences under different setups. Preference adherence, correctness, and safety are separate results, and a completed comparison can show a tie or a loss. [Published results](../../evals.md) describe the measurements and their limits.

## Setups compared

| Setup | Report name | Inputs |
| --- | --- | --- |
| Without Shadowclone or user skills | `bare` | Repository guidance only, with personal memory disabled |
| With user skills | `original` | The participant's existing skills and native instructions |
| With Shadowclone skills | `first-time` | User skills plus Shadowclone setup with a scripted wizard build |
| With Shadowclone skills and deep learning | `deep` | Setup after migrating the learned profile and running deep learning to completion |

Each setup gets an isolated agent home. The setups with user skills start from identical native memory, and none receives an aggregated profile. The historical study used GPT-6 Sol at medium effort for learning. Preparation automatically applied nonconflicting proposals, so the deep arm measured a completed study setup rather than ordinary user review.

Candidates run through the agent's own CLI and native skill discovery: Codex with GPT-6 Sol at medium effort or GPT-6 Luna at high effort, and Claude Code with Sonnet 5.5 at high effort or Opus 5.5 at medium effort.

## Phases

Each phase gates the next, and every phase writes to a private study directory.

| Phase | What it does |
| --- | --- |
| `prepare` | Builds the arms in isolated homes: `original`, `first-time`, `deep`, `deep-continue`, `resolve`, `activate`, then `freeze`. For Claude, `claude` installs its routing and `freeze-claude` captures its files |
| `coverage` | Audits which key items each arm's guidance covers, and stops if deep covers nothing first-time lacks |
| `assemble` | Builds a draft suite from the preparation, key, and task files |
| `derive` | Builds a suite for an agent and model from a candidate suite, keeping its tasks, checks, and analysis. `--model` and `--effort` select the model |
| `validate` | Verifies code fixtures, calibrates judged checks, runs bare and told controls, and freezes the checks that discriminate into `<suite>.frozen.json`. `--report-only` runs the controls and drops nothing |
| `run` | Runs the scored matrix with bounded concurrency. `--arms` runs only the listed arms |
| `report` | Reduces the scored receipt to checks followed per task and setup with multiples over the baseline, adherence, fidelity, group results, and bootstrap intervals. It names the scorer version and product revisions present in each arm. `--base-receipt-file` supplies sessions for tasks or arms not rerun. `--candidate-suite-file` adds the achievable view, which rescores stored sessions against every candidate check that told passed |

```bash
shadowclone eval --protocol preference-study-v1 --phase prepare --stage original --preparation-file <file> --yes
shadowclone eval --protocol preference-study-v1 --phase coverage --preparation-file <file> --key-file <file> --yes
shadowclone eval --protocol preference-study-v1 --phase validate --suite-file <draft> --output-directory <dir> --yes
shadowclone eval --protocol preference-study-v1 --phase run --suite-file <frozen> --output-directory <dir> --yes
shadowclone eval --protocol preference-study-v1 --phase report --suite-file <frozen> --output-directory <dir> --coverage-file <file> --yes
```

## Tasks and checks

Tasks are short requests on a synthetic repository with Git history, a local remote, and an offline `gh` stub that records pull request creation. Prompts are sent verbatim, with no evaluation preamble and no statement of the preference being measured. Code tasks carry hidden acceptance tests.

Most checks are deterministic: introduced comments and unsafe types, positional parameters, action order, commit subjects, pull request records, and answer length. Semantic checks need calibrated examples and two blinded judgments, and disagreement stays unknown.

## Isolation

Candidates run in disposable workspaces and homes. Native filesystem policies confine writes, deny credential reads, and disable the network. Git writes are allowed only in the disposable workspace and its local remote, so the study scores them instead of treating them as safety failures.

Claude Code runs with its own sandbox, and a Claude workspace imports the shared repository instructions through `CLAUDE.md`. Advice tasks mount their workspace read-only. Neither agent runs inside a second sandbox, because native sandbox helpers cannot start nested. A model mismatch or a change to protected guidance stops the run.

## Controls and freezing

Before personal arms run, bare and told controls select the checks, separately for each agent and model. Told is bare plus the task's preferences stated in the prompt. A check stays only if told passes it twice and bare fails it at least once. The frozen suite keeps checks bare fails.

The achievable view also keeps checks bare already meets and drops only checks that told fails or that never apply. A task with no kept check leaves the suite.

Freeze the key, wizard build, resolution rule, tasks, checks, environments, model, CLI version, and product commit before scoring. Each new run records its product commit and working-tree fingerprint so mixed receipts can identify their revisions. Historical runs without this field report an unknown revision. Resume never changes frozen inputs.

## Budgets and recovery

Each phase has a call ceiling and a deadline. Sessions persist as they finish. Resume runs only missing work, marks interrupted sessions as errors, and never repeats an unfavorable result. Unknown cost is retained as unknown. Provider interruptions stop the phase so it can resume later without changing the frozen model or inputs.

## Interpretation

The headline view keeps every achievable check, and a second view keeps only checks bare fails. Both weight tasks equally. Unknown and not-applicable checks are reported but excluded from rates and count denominators. Observed checks before a later infrastructure error remain scored; dropped tasks also leave session and error totals. The report phase rescores deterministic checks in both views from stored actions and responses. Fidelity restricts an arm to the key items its guidance covers. Intervals resample tasks and then complete sessions within a task, and a comparison counts only when its 95% interval excludes zero. The published aggregates were recomputed with `session-bootstrap-2` on 2026-09-30 without new model calls.

Small samples, eight to ten tasks per agent, and one participant's preferences limit the result. The preference key and deep learner used the same session sample, tasks were assembled after coverage analysis, and some tasks were reused after fixes. Future held-out tasks should be frozen before coverage analysis. Each agent has its own checks, so results compare setups within an agent, never agents with each other.

A favorable score does not offset a correctness or safety regression. Reduced reports omit prompts, private guidance, and code evidence. [Data handling](../data-handling.md) covers provider access and local storage, and the [design record](../design/027-preference-study.md) explains the method.
