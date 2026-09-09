# Design record

Every product or architecture change starts with a design record written against `template.md`. Write it before implementation, then finalize its decisions and validation before presenting the pull request. Each pull request checks whether public documentation, contributor rules, the capability matrix, or the architecture diagram changed in meaning and updates only the affected documents.

The table is chronological by the first recorded decision. Append new records at the bottom so a future contributor can follow why the system changed over time.

| Date | Record | Status | Decision |
| --- | --- | --- | --- |
| 2026-09-05 | [001, Agent transcript learning](001-agent-transcript-pivot.md) | implemented | Learn from existing agent transcripts and act through the user's authenticated agent CLI |
| 2026-09-05 | [002, CI and release](002-ci-and-release.md) | implemented | Run the repository gate on Linux and macOS and publish from version tags |
| 2026-09-05 | [003, Provider expansion](003-provider-expansion.md) | active | Qualify observation, distillation, and dispatch support independently for each provider |
| 2026-09-06 | [Evaluation representation](eval-representation.md) | implemented | Compare replay behavior through privacy-safe action fingerprints |
| 2026-09-08 | [004, Confirmed safety fixes](004-confirmed-safety-fixes.md) | implemented | Correct repository identity, redaction, probe, install, and dispatch configuration defects |
| 2026-09-08 | [005, Capture and capability truth](005-capture-and-capability-truth.md) | implemented | Permit boolean source presence checks and align public claims with implemented behavior |
| 2026-09-08 | [006, Profile record lifecycle](006-profile-record-lifecycle.md) | implemented | Keep rule identity stable across wording changes and make profile lifecycle state explicit |
| 2026-09-08 | [007, Bounded learning execution](007-bounded-learning-execution.md) | implemented | Isolate semantic learning and bound its total calls, time, and provider-supported cost |
| 2026-09-08 | [008, Seed guidance library](008-seed-skill-library.md) | implemented | Separate concise profile preferences from complete task-specific Agent Skills |
| 2026-09-08 | [009, Onboarding wizard](009-onboarding-wizard.md) | implemented | Select declared behavior before asking only relevant capture consent questions |
| 2026-09-09 | [010, Import existing repository guidance](010-import-repository-guidance.md) | implemented | Import supported repository instructions as stable, redacted, repository-scoped profile rules |
| 2026-09-09 | [011, Learning report boundary](011-learning-report-boundary.md) | implemented | Keep structural evidence in a report and write mined rules only through explicit deep distillation |
| 2026-09-09 | [012, Deep learning reconciliation](012-deep-learning-reconciliation.md) | implemented | Reconcile redacted evidence with existing guidance before applying profile changes |
