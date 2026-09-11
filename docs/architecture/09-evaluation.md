# Transfer evaluation

The evaluator is an experimental instrument for comparing a baseline agent with an agent receiving learned guidance. It does not establish human equivalence, product-market fit, or general alignment. No paid evaluation result is claimed by this remediation.

## Design

`shadowclone eval` selects eligible historical requests with identifiable starting commits. It learns a profile using earlier evidence with held-out sessions excluded. It freezes opted-in instructions, skills, and memory and supplies the same context to both arms. Each task runs in a separate snapshot, with arm order alternating across repetitions.

Observed files and actions are evidence. The agent's own response is a claim. Independent repository verification runs under a separate OS boundary with no credentials or network. Its raw output does not enter judge evidence. Semantic judgments are repeated with reordered requirements, and disagreements remain uncertain.

The old replay runner and its CLI route have been removed. Pure replay scoring utilities used elsewhere remain available and are not an alternate executable evaluation path.

## Cost and resume

Claude evaluation defaults to a $2 total requested budget. Preparation, training, reconciliation, baseline, clone, judge, repeats, and retries share one persisted ledger. Calls receive only the remaining allowance. Unknown usage stops further dollar-budget calls, and an interrupted call cannot restore its reservation on resume. Native provider billing may exceed a limit during an in-flight request.

Codex cannot enforce the dollar-budget option. Use invocation counts and timeouts; unknown subscription cost is not reported as zero. The interactive preview describes both controls. `--yes` and `--json` bypass the interactive confirmation.

Private `state.json` stores frozen inputs, context, profiles, and evidence. `budget.json` stores cumulative accounting. `--eval-id` resumes compatible state with the original accounting. Older state without trustworthy accounting is rejected. Reports are separate: `report.json` and `--json` contain metrics and opaque identifiers without private prompts, paths, profiles, or evidence text.

## Limitations

Coverage depends on qualifying historical evidence and reproducible dependencies. The authenticated evaluation agent retains its supported host-read permissions. Verification isolation is narrower and fails closed when unavailable. Automated judgments can be mistaken, and passing repository scripts do not establish the quality of every task outcome. Provider and operating-system behavior require supported-platform verification.
