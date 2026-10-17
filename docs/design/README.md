# Design records

These records explain the decisions behind current behavior and their tradeoffs. When a design replaces an earlier one, delete the earlier record. For a guide to current behavior, use the [architecture](../architecture/README.md) and the [user guide](../../README.md).

Start a new decision with the [template](template.md), or extend the relevant record. Include only the sections that people need to understand and verify the change. Keep implementation-session logs out of these pages.

| Record                                                                         | Decision                                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [001: Transcript learning](001-agent-transcript-pivot.md)                      | Sessions and authenticated CLIs replace shell-only learning                                                             |
| [002: CI and release checks](002-ci-and-release.md)                            | A shared gate and verified releases. npm publishing later replaced archive publishing                                   |
| [003: Provider qualification](003-provider-expansion.md)                       | Qualify capture, model execution, actions, and native delivery separately                                               |
| [004: Safety fixes](004-confirmed-safety-fixes.md)                             | Fix scope, redaction, probes, installation, and clean-exit policy                                                       |
| [005: Consent and capability claims](005-capture-and-capability-truth.md)      | Limit checks before consent. Tell implementation apart from qualification                                               |
| [007: Learning limits](007-bounded-learning-execution.md)                      | Shared budgets, isolation, and reusable checkpoints                                                                     |
| [008: Bundled guidance](008-seed-skill-library.md)                             | Separate concise preferences from complete workflows                                                                    |
| [010: Guidance import](010-import-repository-guidance.md)                      | Read supported instruction paths with separate consent and exact scope                                                  |
| [011: Reports and learning](011-learning-report-boundary.md)                   | Keep structural observations separate from semantic guidance                                                            |
| [012: Reconciliation](012-deep-learning-reconciliation.md)                     | Interpret evidence against existing guidance and user decisions                                                         |
| [015: Automatic learning](015-automatic-preference-learning.md)                | Durable steering, separate consent, bounded background work                                                             |
| [017: Portable environment](017-self-improving-agent-environment.md)           | Live context, useful-session attribution, skill sync, and fresh-task evaluation                                         |
| [019: Setup and first learning](019-launch-readiness.md)                       | Simplify setup, bound the first pass, and reach spawned agents                                                          |
| [021: Isolation remediation](021-remediation-completion.md)                    | OS enforcement, consistent snapshots, private storage, and reports                                                      |
| [022: Repository setup](022-repository-harness.md)                             | Preview shared instructions and configure executable checks                                                             |
| [023: Skills delivery](023-skills-as-delivery.md)                              | Maintain workflows directly and keep the original baselines unchanged                                                   |
| [024: Agent builds](024-agent-builds.md)                                       | Browser and terminal editing over shared publication, with budget and check fixes                                       |
| [025: Documentation](025-documentation.md)                                     | Short entry points, task guides, current architecture, and concise design history                                       |
| [026: Synthetic secret fixtures](026-synthetic-secret-fixtures.md)             | Keep credential-shaped test inputs reproducible and identifiable as synthetic                                           |
| [027: Preference evaluation](027-preference-study.md)                          | Five fixed setups, shared learning preparations, isolated execution, and family-weighted reports                        |
| [028: From correction to guidance](028-shadowclone-0-to-1.md)                  | Reliable consented learning, review, publication, delivery, and evaluation for Claude Code and Codex                    |
| [029: Narrow the surface](029-narrow-the-surface.md)                           | Remove shell history and `shadowclone run`, and keep learning evidence user-authored                                    |
| [030: shadowclone-work evaluation](030-shadowclone-work-eval.md)               | Ready-for-review workflow, reviewer comment rules, a fake-`gh` evaluation, and removal of the task harness              |
| [032: Bundled skill quality](032-bundled-skill-quality.md)                     | One checked quality bar, a consequence-first decision policy, voice, and the same delivery for every host               |
| [033: Wizard map and voice](033-wizard-map-and-voice.md)                       | A fast model tier, a horizontal star map that shows every skill, random stars, build names, voice review                |
| [034: Evaluations outside src](034-evals-outside-src.md)                       | Evaluation code moves to `evals/` and leaves the shipped CLI bundle, which shrinks from 4,683 KB to 747 KB              |
| [035: Acknowledge requests](035-acknowledge-requests.md)                       | An `eyes` reaction shows that the clone accepted a request                                                              |
| [036: Pull request review](036-pull-request-review.md)                         | One review skill with refuters, deterministic rules and toolchain checks, and secret-separated cloud jobs               |
| [038: Workspace packages and plain English](038-packages-and-plain-english.md) | Bun and Turborepo workspace packages with no import cycles, plain English always on, and shorter docs                   |
| [039: Review evaluation](039-review-evaluation.md)                             | One case format for real vite defects and planted defects, with blind judges from two vendors who must agree on a label |
| [040: Guided PR review](040-guided-pr-review.md)                               | Connected PR guides, inline human notes, optional pending reviews, and a separate portable skill artifact               |
| [041: Learning triage](041-learning-triage.md)                                 | Coverage from the user's own files, session-end triage with undo, and private repository delivery                       |
| [042: Compare related tools](042-compare-alternatives.md)                      | A README opening about one skill set for local and cloud agents, and a dated comparison with related tools              |
| [043: Cloud bot on API keys](043-cloud-bot-api-keys.md)                        | One machine account on one provider API key, tags from anyone with write access, and a check run after setup            |
| [044: Cloud sessions](044-cloud-sessions.md)                                   | The owner's own subscription on a host that the owner owns, started only by the owner, with state in GitHub             |
| [045: Missing repository folders](045-missing-repository-folders.md)           | Sync removes the registration of a folder that no longer exists, and sync errors name the skill or folder               |
| [046: Preserved integration files](046-preserved-integration-files.md)         | Sync names each preserved file and its reason, replaces it on request, and stops false edit reports                     |
| [047: Missing build skills](047-missing-build-skills.md)                       | Routing leaves out a build skill that has no copy, and sync names it and exits with status 1                            |
