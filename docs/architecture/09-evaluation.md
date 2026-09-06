# Replay Evaluation

The evaluation subsystem measures whether an engineering profile reliably shifts agent behavior toward historical developer choices.

Replay evaluation is exposed through `shadowclone eval`. It does not rely on subjective inspection or benchmark suites. Instead, it tests whether replaying past user prompts through a profiled clone reproduces developer tool patterns, verification steps, and planning habits better than an unprofiled baseline.

## Why replay evaluation

A behavioral memory compiler needs a falsifiable fitness function.

Traditional benchmark suites (e.g. SWE-bench) evaluate whether an agent can solve a canned GitHub issue. They do not measure alignment with an individual engineer's idiosyncratic habits: test runners, custom linters, planning before editing, or tool refusals.

`shadowclone eval` re-executes real user prompts from the local session index through two runs:
1. **Baseline run:** unprofiled agent invocation without system prompt customization.
2. **Clone run:** agent invocation with the compiled project profile injected via `--system-prompt-file`.

Both runs execute in isolated temporary environments under non-interactive permission modes with strict budget ceilings.

## Privacy-safe action representation

The evaluation loop compares actions taken by the baseline and the clone against the ground truth of historical sessions.

To prevent re-exposing sensitive source code, prompt contents, or file diffs, runs emit privacy-safe action fingerprints:
- **Tool choice:** set of tool names invoked during the session.
- **Repository-relative posix paths:** normalized relative paths of edited files without contents or diffs.
- **Verification tokens:** the leading two tokens of bash verification commands (e.g. `bun test`, `cargo check`).
- **Planning habits:** boolean indicating whether planning tools were invoked before the first file edit.

Ground-truth indexed events contain tool invocations and planning events. File paths are omitted from the disposable index schema, so path similarity is excluded from the average score when absent on ground truth.

## Delta scoring

Replays are scored across four dimensions:
- `tools`: Jaccard similarity of invoked tool sets.
- `verification`: Jaccard similarity of two-token bash verification commands.
- `files`: Jaccard similarity of normalized repo-relative paths.
- `planning`: binary match on whether planning preceded file modifications.

Dimensions that are empty or null on both sides are excluded from the session total rather than defaulting to vacuous 1.0 similarity.

The eval subsystem computes the difference between clone similarity and baseline similarity:

```
delta = clone_similarity - baseline_similarity
```

A positive total delta demonstrates that the profile actively steers the agent toward developer habits compared to default unprofiled behavior.

## Execution receipts

Every evaluation run outputs a structured JSON receipt to `~/.shadowclone/eval/<evalId>.json`.

Receipts record per-session metrics, aggregate averages, and run parameters, enabling historical tracking of profile quality across versions.
