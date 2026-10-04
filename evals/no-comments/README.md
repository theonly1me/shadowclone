# No-comments eval

This study tests one idea: coding agents write more readable code when they are not allowed to write comments, because the code has to explain itself. Read the [headline](HEADLINE.md) first for the summary, and the [code examples](EXAMPLES.md) to see what the code looked like. This page documents exactly what ran.

It is not part of Shadowclone's preference benchmarks. No Shadowclone profile, skill, or instruction was used in any run.

## Design

One task, four model settings, two conditions, ten runs per cell. That is 80 runs, 160 judge calls, and 40 judged pairs.

| Setting | Agent CLI | Model | Effort |
| --- | --- | --- | --- |
| Sonnet 5.5, high | Claude Code 2.1.289 | `claude-sonnet-5-5` | high |
| Opus 5.5, medium | Claude Code 2.1.289 | `claude-opus-5-5` | medium |
| GPT 6 Luna, high | Codex CLI 0.159.0 | `gpt-6-luna` | high |
| GPT 6.1 Sol, medium | Codex CLI 0.159.0 | `gpt-6.1-sol` | medium |

| Condition | Prompt |
| --- | --- |
| A, comments allowed | The [task prompt](task/prompt_base.md). It never mentions comments. |
| B, comments banned | The same prompt plus one sentence: "Do not write any comments in code. This includes # comments and docstrings." ([file](task/ban_suffix.md)) |

Run order was shuffled with a fixed seed and interleaved across all cells, four runs at a time, between 2026-10-04 20:36 and 21:21 UTC. Mean run time was 65 seconds for Sonnet, 86 for Opus, 194 for Luna, and 212 for Sol.

### The task

The agent works in `ledger`, a small subscription billing library in the [seed repo](task/seed_repo): 7 modules, 15 passing tests, all money in integer cents. The prompt asks for usage-based billing with mid-cycle plan changes: idempotent usage events, late events, proration with half-up rounding, plan-change validation, overage with floored allowances, and a fixed order of discount, credit, and tax. The prompt states 12 rules, so every behavior the hidden tests check is specified. The agent must also keep the existing tests passing, add tests, and run the suite.

The seed code has 3 comments. Both conditions start from the same code.

### Isolation

Every run gets a fresh copy of the seed repo in a new temporary directory, initialized as a git repository with a baseline commit. Nothing carries over between runs. The hidden tests are not in the workspace during the run. They are copied in after the agent exits.

**Claude Code runs** use the default system prompt and these flags: `-p`, `--model`, `--effort`, `--setting-sources ""`, `--disable-slash-commands`, `--strict-mcp-config`, `--no-session-persistence`, `--output-format stream-json --verbose`, `--allowedTools Bash,Edit,Write,Read,Glob,Grep`, and a settings override that asks for the Bash sandbox. Auto-memory is switched off with `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. The start-up event of each run shows no skills, no MCP servers, and only built-in plugins. A probe prompt found no instruction file in context. Whether the Bash sandbox was enforced was not verified.

**Codex runs** use `codex exec -s workspace-write` with a dedicated `CODEX_HOME` that holds only a copy of the login file and a one-line `config.toml` (`personality = "none"`). The probe found no instruction files, and only the skills Codex bundles itself (image generation, OpenAI docs, skill creator, skill installer). All Codex runs share that one home and start new sessions.

The [agent invocation code](harness/agents.py) holds the exact commands. Both CLIs ran under a minimal environment: a clean `PATH` with a Python environment that has pytest, and no inherited variables.

### Grading

1. **Hidden tests.** 50 tests in [graders/hidden_tests](graders/hidden_tests). A reference solution passes all 50, and the unmodified seed fails them. The tests only use the public API stated in the prompt.
2. **Comment count.** The [counter](graders/comments.py) uses Python's tokenizer for `#` comments and the parser for docstrings. It counts comments in changed or added files that were not in the baseline version of the same file. A B run with any new comment would count as non-compliant.
3. **Static metrics.** The [measurements](graders/static_metrics.py) cover changed source files, with comments removed first: code lines, function count, mean and maximum function length, maximum cyclomatic complexity (radon), mean identifier length, maximum nesting depth, and ruff warnings.
4. **Blind pairwise judge.** Within each setting, A run *i* is paired with a randomly chosen B run, using each run once, so there are 10 pairs per setting. The judge sees only the source files the agent changed, with all comments and docstrings stripped from both. It never learns which side is which. Each pair is judged in both orders by two judges: Opus 5.5 high through Claude Code and GPT 6.1 Sol high through Codex. That gives 4 verdicts per pair, averaged into one pair score, with a tie counting as half. The judge answers 10 true-or-false claims about each side ([rubric](graders/judge/rubric.md)) and then picks the side that is easier to read, understand, and change. It is told to ignore correctness.

### Analysis, fixed before the final runs

The primary outcome is the pooled win rate of B over A across all 40 pairs, with a 95% bootstrap interval (10,000 resamples) and a sign-flip permutation test against 50%. Per-setting results are descriptive. Metrics report the mean for A and B and the difference B minus A with a 95% bootstrap interval. All four settings are reported.

## Results

### Blind judge

| Setting | Pairs | B judged easier to read | 95% interval | p | Rubric claims true, A / B |
| --- | ---: | ---: | --- | ---: | --- |
| All four settings | 40 | **59.4%** | 47.5% to 71.3% | 0.164 | 31.9% / 36.8% |
| Sonnet 5.5, high | 10 | 68% | 38% to 93% | 0.34 | 33% / 44% |
| Opus 5.5, medium | 10 | 85% | 68% to 97% | 0.009 | 35% / 43% |
| GPT 6 Luna, high | 10 | 45% | 25% to 65% | 0.82 | 24% / 25% |
| GPT 6.1 Sol, medium | 10 | 40% | 20% to 62% | 0.52 | 36% / 35% |

By judge, pooled: Opus 5.5 as judge picked B 55% of the time (44% to 65%), and GPT 6.1 Sol as judge picked B 64% of the time (53% to 74%). The judges agreed on 60 of 80 pair-order verdicts. The same judge gave the same answer after the order was swapped in 64 of 80 cases. The first-shown side won 51% of the time, so there is no sign of a position bias.

### Comments written and correctness

| Setting | New source comments, A | New source comments, B | New test comments, A | Hidden tests passed, A / B | Runs obeying the ban |
| --- | ---: | ---: | ---: | --- | ---: |
| Sonnet 5.5, high | 6.3 | 0 | 16.7 | 500/500 / 500/500 | 10 of 10 |
| Opus 5.5, medium | 6.7 | 0 | 12.6 | 500/500 / 500/500 | 10 of 10 |
| GPT 6 Luna, high | 1.9 | 0 | 0.0 | 499/500 / 498/500 | 10 of 10 |
| GPT 6.1 Sol, medium | 1.0 | 0 | 0.9 | 500/500 / 500/500 | 10 of 10 |

Comment columns are the mean per run. Three Luna runs, one in A and two in B, each missed one hidden test. All other runs passed all 50.

### Code measurements

Difference B minus A, mean with 95% interval. Of the 48 intervals computed for all measures, 6 exclude zero. Four of those are the comment count, which the ban removes by design. The other two are Luna's run time (B took about 38 seconds longer) and Sol's mean identifier length (+0.17 characters). Two out of 44 is what chance alone would give at 95%. The three measures below show the structure of the code.

| Setting | Max complexity | Max function length | Code lines |
| --- | --- | --- | --- |
| Sonnet 5.5, high | -1.1 (-3.0 to 1.0) | -3.4 (-7.9 to 1.2) | +3.2 (-15.9 to 23.3) |
| Opus 5.5, medium | -1.5 (-3.2 to 0.2) | +0.8 (-2.9 to 4.3) | +4.2 (-7.0 to 14.9) |
| GPT 6 Luna, high | +0.6 (-1.4 to 2.9) | +0.5 (-5.9 to 6.7) | -16.4 (-37.0 to 5.7) |
| GPT 6.1 Sol, medium | +0.3 (-0.7 to 1.3) | +0.2 (-1.9 to 2.2) | +2.5 (-6.4 to 11.1) |

All measures, including function count, identifier length, nesting depth, ruff warnings, and run time, are in [runs/analysis.json](runs/analysis.json).

## How the study went

- A pilot of 8 runs (one per cell) checked isolation and the harness. All 8 passed all hidden tests, so the task has no correctness headroom. We kept the task unchanged and relied on readability as the main outcome. The pilot runs are not part of the results.
- All 80 final runs completed. There were no timeouts and no infrastructure failures, and no run was repeated.
- One judge verdict could not be parsed. It was removed and that single call was run again.
- While judging was still running, we looked at interim win rates. No decision changed because of that look. The analysis in this page was run once on the complete data.
- The harness binary lookup and temporary directory were made portable after the runs. Behavior did not change, and rerunning the analysis on the published results reproduces every number.
- Codex printed a warning in some runs that an unauthenticated connector had quit. It had no effect on the work.

## Limits

- One task, one codebase, ten runs per cell. The pooled interval spans 48% to 71%.
- The judges are language models. Two judges from different families agreed on 75% of verdicts, not all.
- The seed code has 3 comments, and Claude Code's default prompt tells the model to match the comment density of the surrounding code. Both may pull condition A toward more comments.
- Settings differ in reasoning effort, so compare A against B inside a setting, never across settings.
- Condition B adds an instruction, so the study cannot separate the effect of banning comments from the effect of adding any extra instruction.
- The hidden tests are published here, so a future model could have seen them.

## Reproduce

Install `requirements.txt` into a `.venv` in this folder, log in to the Claude Code and Codex CLIs, then run from this folder:

```bash
python -m harness.run_all --repetitions 10 --concurrency 4
python -m graders.judge.run --concurrency 4
python -m analysis.analyze
```

Set `EVAL_LEAK_MARKERS` to distinctive strings from your own instruction files and run `python -m harness.isolation_check <setting>` to check that none reach a run. The schedule, pairing, and bootstrap use fixed seeds. Model outputs vary between runs.

## Files

| Path | Contents |
| --- | --- |
| [EXAMPLES.md](EXAMPLES.md) | Two judged code pairs, side by side |
| [task](task) | Seed repo, task prompt, ban sentence |
| [graders](graders) | Hidden tests, reference solution, comment counter, static metrics, judge |
| [harness](harness) | Runner, scheduler, isolation check, and the four settings in `matrix.json` |
| [analysis](analysis) | Statistics and tables |
| [runs/analysis.json](runs/analysis.json) | All computed results |
| [runs/judgments.jsonl](runs/judgments.jsonl) | All 160 judge verdicts |
| `runs/<setting>/<A or B>/<run>/` | Per-run grades (`result.json`), the agent's diff, and the files it changed |

Agent transcripts are not published. They contain local paths and session details. Per-run cost figures are removed.
