# Headline: does banning comments make LLM code better?

**Short answer: a little. Blind judges preferred the comment-free code in about 6 of every 10 pairs, and a second batch of runs showed the same.**

We asked four model settings to add the same feature to a small Python codebase, twenty times each, in two ways. In one, the prompt said nothing about comments. In the other, it banned all comments and docstrings. Blind judges then compared the code with every comment removed from both sides.

| Result | Value |
| --- | --- |
| Banned-comment code judged easier to read, all 80 pairs | **62%** (95% interval 53% to 70%, p = 0.009) |
| First batch alone, 40 pairs | 59% (48% to 71%, p = 0.16) |
| Second batch alone, 40 new pairs | 64% (53% to 76%, p = 0.027) |
| Opus 5.5 medium | 75% (59% to 89%) |
| Sonnet 5.5 high | 69% (51% to 85%) |
| GPT 6 Luna high | 54% (39% to 69%) |
| GPT 6.1 Sol medium | 50% (34% to 66%) |
| Hidden tests passed | 7,995 of 8,000 across both conditions, so no loss of correctness |
| Runs that obeyed the ban | 80 of 80 |

## What to take from it

- The effect is small but consistent. The comment-free code won about 62% of pairs, where 50% would mean no difference. The second batch was planned before it ran, so it is a fresh check, and it agreed.
- The Claude models gained the most. Sonnet 5.5 and Opus 5.5 wrote about 6 source comments per run when free to, and the judges preferred their comment-free versions in 69% and 75% of pairs.
- The Codex models are unclear. GPT 6 Luna and GPT 6.1 Sol wrote only 1 to 2 source comments per run, so the ban changed little. They were near 50% overall and above 50% in the second batch, but each has only 20 pairs, too few to tell.
- The ban did not cost correctness. Every setting passed the hidden tests at the same rate with and without it.
- Simple code measurements showed little. Sonnet's comment-free code had a lower maximum complexity (1.7 lower) and a shorter longest function (4.5 lines shorter). Most other measurements did not move.

## What not to take from it

- This is one task in one codebase, judged by language models. The size of the effect, about 12 points above a coin flip, is modest.
- The 62% figure comes from extending the study after seeing the first batch, so its p-value is somewhat optimistic. The second batch alone (p = 0.027) is the cleaner check.
- The per-setting results are descriptive. With four settings and 20 pairs each, one setting looking good or bad is expected by chance.
- The model settings differ in reasoning effort, so compare the two conditions inside a setting, not settings against each other.

See [code examples](EXAMPLES.md) for the same code written with and without comments. The full method, exact prompts, isolation steps, limits, and raw results are in the [README](README.md). This was run for fun on 2026-10-04 and 2026-10-05 (UTC).
