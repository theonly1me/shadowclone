# No-comments eval

I wanted to know if coding agents write more readable code when they are not allowed to write comments. The idea is that code has to explain itself when it cannot lean on a comment.

I gave four model settings the same feature request in a small Python codebase, twenty times each. Half the time the prompt said nothing about comments. The other half it banned them. Two LLM judges then compared the code side by side, blind, with every comment stripped out of both versions.

## Headline

**Short answer: yes, in this test. The judges preferred the comment-free code in 62% of pairs, and a second batch of runs agreed. The Claude models showed it most clearly.**

The comment-free code won **62% of 80 pairs** (95% interval 53% to 70%, p = 0.009). A coin flip would give 50%. The first batch of 40 pairs gave 59% (p = 0.16), which was not significant. I wrote down the rules for a second batch, committed them, and then ran it. That batch gave 64% on its own (p = 0.027).

| Setting | Source comments per run when free to comment | Comment-free code judged easier to read |
| --- | ---: | ---: |
| Claude Sonnet 5.5, high | 6.2 | 69% (51% to 85%) |
| Claude Opus 5.5, medium | 6.2 | 75% (59% to 89%) |
| GPT 6 Luna, high | 2.0 | 54% (39% to 69%) |
| GPT 6.1 Sol, medium | 1.3 | 50% (34% to 66%) |

- **The Claude models gained the most.** They comment a lot when allowed, and the judges preferred their comment-free versions.
- **The Codex models are unclear.** They barely comment, so the ban changed little. They sat near 50% overall and above 50% in the second batch, but 20 pairs each is too few to tell.
- **The ban did not cost correctness.** The models passed 7,995 of 8,000 hidden tests across both conditions, and all 80 banned-comment runs obeyed the ban.
- **Simple code measurements showed little.** Sonnet's comment-free code had a lower maximum complexity (1.7 lower) and a shorter longest function (4.5 lines shorter). Most other measurements did not move.

## How it worked

1. **The task.** The agent adds usage-based billing and mid-cycle plan changes to `ledger`, a small subscription billing library in [`task/seed_repo`](task/seed_repo). The [prompt](task/prompt_base.md) states 12 rules, so the result can be graded by tests.
2. **The two conditions.** In A, the prompt does not mention comments. In B, it adds one sentence: "Do not write any comments in code. This includes # comments and docstrings."
3. **Clean runs.** Every run starts in a fresh copy of the repo, with no user instructions, skills, or MCP servers. Claude Code and Codex run in headless mode.
4. **Grading.** 50 [hidden tests](graders/hidden_tests) check behavior. A [counter](graders/comments.py) checks that banned runs wrote no comments. Two judges, Claude Opus 5.5 and GPT 6.1 Sol, compare each pair in both orders on a [rubric](graders/judge/rubric.md) of readability checks.

## Limits

- It is one task in one codebase, graded by language models. The lead over a coin flip is 12 points, and the interval runs from 3 to 20 points.
- I extended the study after seeing the first batch, so the combined p-value is somewhat optimistic. The second batch alone is the cleaner check.
- Per-setting results are descriptive. With four settings and 20 pairs each, one setting looking good or bad is expected by chance.
- The seed code has 3 comments, and Claude Code's own prompt tells the model to match the comments around it. Both may pull condition A toward more comments.
- Reasoning effort differs between settings, so compare A with B inside a setting, not settings against each other.

## Run it yourself

You need the `claude` and `codex` CLIs, logged in, and Python 3.11 or newer. Keep the machine awake while it runs.

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m harness.run_all --repetitions 10 --concurrency 4
.venv/bin/python -m harness.run_all --first-repetition 11 --repetitions 20 --concurrency 4
.venv/bin/python -m graders.judge.run --concurrency 4
.venv/bin/python -m analysis.analyze
```

Set `EVAL_LEAK_MARKERS` to distinctive strings from your own instruction files and run `python -m harness.isolation_check <setting>` first, to check that none reach a run. The four settings are in [`harness/matrix.json`](harness/matrix.json).

## Results and raw runs

The full method, every result table, the code examples, all 160 runs, and all 320 judge verdicts are in [shadowclone-no-comments-runs](https://github.com/theonly1me/shadowclone-no-comments-runs). Start with its [results page](https://github.com/theonly1me/shadowclone-no-comments-runs/blob/main/RESULTS.md) and [code examples](https://github.com/theonly1me/shadowclone-no-comments-runs/blob/main/EXAMPLES.md).
