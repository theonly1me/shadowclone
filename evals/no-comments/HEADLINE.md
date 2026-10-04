# Headline: does banning comments make LLM code better?

**Short answer: it leans that way, but the result is not statistically significant.**

We asked four model settings to add the same feature to a small Python codebase, ten times each, in two ways. In one, the prompt said nothing about comments. In the other, it banned all comments and docstrings. Blind judges then compared the code with every comment removed from both sides.

| Result | Value |
| --- | --- |
| Banned-comment code judged easier to read | **59%** of pairs (95% interval 48% to 71%, p = 0.16) |
| Strongest setting, Opus 5.5 medium | 85% (95% interval 68% to 97%, p = 0.009 on its own) |
| Weakest settings, GPT 6 Luna high and GPT 6.1 Sol medium | 45% and 40%, which is no sign of an effect |
| Hidden tests passed | 3,997 of 4,000 in both conditions combined, so no loss of correctness |
| Runs that obeyed the ban | 40 of 40 |

## What to take from it

- Where a model comments a lot when it is free to, the ban helped. Sonnet 5.5 and Opus 5.5 wrote about 6 to 7 source comments per run without the ban, and both leaned toward the banned version.
- Where a model barely comments anyway, the ban changed nothing. GPT 6 Luna and GPT 6.1 Sol wrote 1 to 2 source comments per run, and the judges saw no difference.
- The ban did not cost correctness. Every setting passed the hidden tests at the same rate with and without it.
- Simple code measurements (function length, complexity, line count) showed no consistent change.

## What not to take from it

- The pooled result is not statistically significant. It is a trend, not a finding.
- Only Opus 5.5 is clear on its own, and picking the best of four settings overstates it.
- It is one task, one codebase, and ten runs per cell. The judges are language models.
- The model settings differ in reasoning effort, so compare the two conditions inside a setting, not settings against each other.

See [code examples](EXAMPLES.md) for the same code written with and without comments. The full method, exact prompts, isolation steps, limits, and raw results are in the [README](README.md). This was run for fun on 2026-10-04 (UTC).
