# Evaluation compatibility

These options preserve earlier research protocols and receipts. Start with the [evaluation guide](architecture/09-evaluation.md) for the skills environment.

## Linked comparisons

Linked modes create a stable child receipt while preserving the parent's frozen evidence and accounting. Repeating a command resumes that child; it does not create another allowance. Keep the required protocol, repository, model, effort, call limit, deadline, and `--yes` arguments.

| Mode | Required budget argument | Limits |
| --- | --- | --- |
| `--validation-of <pilot-id>` | `--cumulative-budget-usd` | $10 including parent spend, 48 new calls, 45 minutes |
| `--maintenance-of <validation-id> --suite-id <id>` | `--additional-budget-usd` | $10 additional, 48 calls, 45 minutes |
| `--comparison-of <maintenance-id>` | `--additional-budget-usd` | $20 additional, 96 calls, 90 minutes |

These modes do not accept `--pilot`, ordinary `--max-budget-usd`, or schema-recovery flags. Maintenance and comparison require exactly `claude-sonnet-5`; Codex does not support linked historical modes. Changed sources, settings, or parent fingerprints block resume. Historical votes remain unchanged when a newer judge contract is introduced.

## Verified schema-preflight recovery

`--recover-preflight-failure --eval-id <id> --failed-cli-version <version>` handles the specific legacy first-judge schema rejection described in [the design record](design/021-guidance-evaluation.md#schema-compatibility-and-measurement-repairs).

Recovery requires a matching local CLI contract proof against a synthetic loopback-only mock. It preserves the original receipt and budget, records the reason for reconciling the rejected call, and permits one audited deadline renewal. It cannot clear a later unknown cost, reset call counts, or repeatedly extend the run. Ordinary resume keeps its original deadline.

## Transfer compatibility

Transfer receipts use `state.json` and reduced `report.json` under the evaluation directory. `--eval-id` reuses saved evidence and completed votes. The deprecated `--dependency-mode current` flag remains accepted without copying or installing a dependency tree.

Unsupported historical schemas are rejected instead of silently upgraded. Keep original private receipts when changing protocols; reduced public reports cannot reconstruct their frozen inputs.
