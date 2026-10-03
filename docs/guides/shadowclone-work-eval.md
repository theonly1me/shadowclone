# shadowclone-work evaluation

This contributor guide runs the `shadowclone-work` evaluation described in [design record 030](../design/030-shadowclone-work-eval.md). It compares no skill with the shipped skill on fifteen synthetic pull request cases.

## Requirements

- An authenticated `claude` CLI. Runs count against your plan or API bill: about $0.17 and one minute per run with `claude-sonnet-5-5`.
- `python3` and `jq` outside your home directory, and Apple's git (Command Line Tools or Xcode) on macOS.
- No symbolic links inside `~/.docker`. Docker Desktop creates links in `~/.docker/cli-plugins` and `~/.docker/bin/lib`. The runner checks for them first and names the folders to move aside while it runs; restore them afterwards.

## Run

```bash
bun run eval:work --runs 3 --baseline-runs 2 --concurrency 4
```

The runner builds two plugin variants under `~/.cache/shadowclone-evals/shadowclone-work/build` (or `--output <dir>`), runs every case, and grades each kept run. Results land in `flow/` next to the build, outside the checkout:

- `baseline/`: no skill
- `v1/`: the skill (`skills/shadowclone-work/SKILL.md`)

Each folder holds `results.jsonl` with one graded row per run, `traces/` with each transcript, and `errors.jsonl` for runs that never produced a gradable result. `--cases <glob>` limits the cases, `--variants skill-only` runs one arm, and `--skill <file> --skill-label v3` evaluates an edited skill as a new variant.

## Read the results

`pass` is 1 only when every rule holds. The other metrics show which rule failed: `checks`, `ready`, `comments` (the share of threads handled correctly), `voice`, `history`, `scope`, `hygiene`, `template`, and the judged `report`. Each row's `meta.failures` names the failed rules in plain words.

Compare arms on the five test cases. Hillclimbing may read only the train cases' transcripts.
