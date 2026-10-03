# Design history

These records explain decisions and tradeoffs. Later records can replace earlier designs; use the [architecture](../architecture/README.md) and [user guide](../../README.md#get-started) for current behavior.

The main delivery changes were transcript learning, native main-agent context, and then portable skills. Designs 006 through 019 include profile-era decisions that remain relevant to migration. Designs 022 through 024 describe repository setup and the skills environment, and design 027 describes the preference study.

Start a new decision with the [template](template.md), or extend the relevant record. Include only sections needed to understand and verify the change. Keep implementation-session logs out of these pages.

| Record | Decision |
| --- | --- |
| [001: Transcript learning](001-agent-transcript-pivot.md) | Sessions and authenticated CLIs replace shell-only learning |
| [002: CI and release checks](002-ci-and-release.md) | A shared gate and verified releases; archive publishing later replaced by npm |
| [003: Provider qualification](003-provider-expansion.md) | Qualify capture, model execution, actions, and native delivery separately |
| [004: Safety fixes](004-confirmed-safety-fixes.md) | Correct scope, redaction, probes, installation, and clean-exit policy |
| [005: Consent and capability claims](005-capture-and-capability-truth.md) | Bound pre-consent checks and distinguish implementation from qualification |
| [006: Profile lifecycle](006-profile-record-lifecycle.md) | Stable identities, user edits, rejections, and activation state |
| [007: Learning limits](007-bounded-learning-execution.md) | Shared budgets, isolation, and reusable checkpoints |
| [008: Bundled guidance](008-seed-skill-library.md) | Separate concise preferences from complete workflows |
| [009: Original onboarding](009-onboarding-wizard.md) | Declared choices, relevant consent, preview, and cancellation |
| [010: Guidance import](010-import-repository-guidance.md) | Read supported instruction paths with separate consent and exact scope |
| [011: Reports and learning](011-learning-report-boundary.md) | Keep structural observations separate from semantic guidance |
| [012: Reconciliation](012-deep-learning-reconciliation.md) | Interpret evidence against existing guidance and user decisions |
| [013: Legacy compilation](013-deterministic-profile-compiler.md) | One bounded profile representation and reversible installation |
| [014: Isolation proposal](014-execution-and-storage-boundaries.md) | Execution and storage controls completed in remediation |
| [015: Automatic learning](015-automatic-preference-learning.md) | Durable steering, separate consent, bounded background work |
| [016: Original skill maintenance](016-skill-maintenance.md) | Amend relevant workflows while preserving ownership |
| [017: Portable environment](017-self-improving-agent-environment.md) | Live context, useful-session attribution, skill sync, and fresh-task evaluation |
| [018: Incremental learning](018-incremental-learning-repair.md) | Preserve legacy records and process requested and unprocessed history |
| [019: Setup and first learning](019-launch-readiness.md) | Simplify setup, bound the first pass, and reach spawned agents |
| [020: Main-agent delivery](020-main-agent-delivery.md) | Managed native instructions and hooks beyond optional subagents |
| [021: Isolation remediation](021-remediation-completion.md) | OS enforcement, consistent snapshots, private storage, and reports |
| [022: Repository setup](022-repository-harness.md) | Preview shared instructions and configure executable checks |
| [023: Skills delivery](023-skills-as-delivery.md) | Maintain workflows directly and migrate with original baselines intact |
| [024: Agent builds](024-agent-builds.md) | Browser and terminal editing over shared publication, with budget and check fixes |
| [025: Documentation](025-documentation.md) | Short entry points, task guides, current architecture, and concise design history |
| [026: Synthetic secret fixtures](026-synthetic-secret-fixtures.md) | Keep credential-shaped test inputs reproducible and identifiable as synthetic |
| [027: Preference study](027-preference-study.md) | One frozen preference key, control-validated checks, and gated four-arm comparisons; earlier protocols removed |
| [028: From correction to guidance](028-shadowclone-0-to-1.md) | Reliable consented learning, review, publication, delivery, and evaluation for Claude Code and Codex |
| [029: Narrow the surface](029-narrow-the-surface.md) | Remove shell history and `shadowclone run`, and keep learning evidence user-authored |
| [030: shadowclone-work evaluation](030-shadowclone-work-eval.md) | Ready-for-review workflow, reviewer comment rules, and a fake-`gh` evaluation that decides the task harness |
