# Code review results

On 40 merged vite pull requests, Greptile found the most known defects. Shadowclone had the highest share of findings that two judges confirmed. OpenQodex was last on every measure of bug finding.

The [code-review-bench](https://github.com/theonly1me/code-review-bench) repository holds the harness and the [full results](https://github.com/theonly1me/code-review-bench/blob/main/results/2026-10-vite/README.md). Anyone can run it with their own Greptile account and their own Shadowclone bot.

## Setup

- **Cases:** 40 merged vite pull requests from March to October 2026. 13 have a defect that a later fix repaired, and 27 are clean.
- **Reviewers:**
  - Shadowclone 0.0.28, local (`shadowclone review`) and as its pull request bot, with the [`shadowclone-review`](../../skills/shadowclone-review/SKILL.md) skill.
  - Greptile, as its pull request bot.
  - OpenQodex 0.11.0, local.
  - The local reviewers and the Shadowclone bot use `claude-opus-5-5`. Greptile uses its own models.
- **Runs:** the local reviewers ran 3 times on each pull request. The bots ran once.
- **Bot copies:** each case is a draft pull request in [theonly1me/code-review-bench-cases](https://github.com/theonly1me/code-review-bench-cases/pulls). Greptile reviewed each pull request first, and the Shadowclone bot second. The Shadowclone review reads only the pull request title, body, and code ([`facts.ts`](../../packages/review/src/collect/facts.ts)), never other comments.
- **Judges:** Claude Opus 5.5 and GPT 6.1 Sol labeled every finding in one anonymous pool `real`, `minor`, or `wrong`. They also named the findings that identify each known defect. A label or a detection counts only when both judges agree.

## Results

| Rank | Reviewer          | Known defects found | Real findings per review | Findings judged real |
| ---- | ----------------- | ------------------- | ------------------------ | -------------------- |
| 1    | Greptile          | 9 of 13 (69%)       | 0.48                     | 68%                  |
| 2    | Shadowclone bot   | 5 of 13 (38%)       | 0.55                     | 96%                  |
| 2    | Shadowclone local | 14 of 39 (36%)      | 0.43                     | 91%                  |
| 3    | OpenQodex         | 12 of 39 (31%)      | 0.30                     | 86%                  |

1. Greptile found every defect that another reviewer found, and three that no other reviewer found. The judges called 68% of its findings real, 9 minor, and 15 disputed.
2. Both Shadowclone setups found the same five defects, with the most real findings per review. They missed four defects that Greptile found.
3. OpenQodex found two of those five defects in only 1 of 3 runs. Its only find that Shadowclone missed came in 1 of 3 runs.

## Limits

- 13 known defects is a small sample, so the intervals are wide.
- The judges disagree on 43 findings, which wait for a blind decision. A decision can change the real share, but not the defect counts.
- Claude Opus 5.5 is a judge and also the model of three reviewers. The rule that both judges must agree reduces this risk.
