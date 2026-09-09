# Onboarding wizard

## Summary

Make `shadowclone init` establish a declared behavioral profile before it asks for capture consent, and add `shadowclone wizard` for deliberate reruns. Onboarding uses package-owned seed preferences and Agent Skills, asks only about capture sources with local data, and never reads an existing rules file or transcript before consent.

## Problem

Before this change, `initialize` wrote a disabled config, asked nine yes-or-no questions, and wrote the selected config. It asked about all six capture sources even when they had no local data, and a successful first run left the user with no behavioral profile unless enough transcript evidence later produced one.

PR 5 supplies four preference axes, one skill axis, and eight optional skills, but no command selects them or turns them into declared profile records. A user can inspect the library, yet the main onboarding entry point still begins with data access questions before showing what the product will build.

## Prerequisites

PR 2 permits onboarding to reduce a configured source root to one ephemeral boolean stating that it exists and is non-empty. Without that amendment, provider-specific consent questions cannot be filtered before consent.

PR 3 provides stable profile keys, declared source records, lifecycle preservation, and `applies-when`. Without those fields, rerunning the wizard could not preserve edits and rejections.

PR 5 provides the validated seed library and axis structure. Without it, the wizard would duplicate its questions and guidance in TypeScript.

## Design

`shadowclone init` performs four ordered steps: detect presence, choose an onboarding path, complete that path, then collect capture consent. It writes no config before the final consent batch.

Presence has two outputs. `hasRulesFile` is true when `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` exists in the working directory. `presentCaptureSources` contains only supported capture source ids whose configured root has local data. Neither output contains a path, entry name, count, timestamp, size, or content.

Directory roots are opened with `opendir`, read once, reduced immediately to `entry !== null`, and closed. The entry object is never stored or returned. File roots use existence and non-zero size only to produce one boolean. Shell presence is true when any configured history file is non-empty. Rules-file detection performs exact `Bun.file(...).exists()` calls against the three fixed names and does not open them.

The onboarding paths are:

| Rules file | Transcript source | PR 6 behavior |
| --- | --- | --- |
| yes | yes | Leave the rules file unread, collect consent, then offer `shadowclone learn` |
| yes | no | Leave the rules file unread, then collect non-transcript capability consent |
| no | yes | Run the wizard, collect consent, then offer `shadowclone learn` |
| no | no | Run the wizard, then collect non-transcript capability consent |

Rules-file contents become the opt-in `declared-rules` source in PR 7. PR 6 deliberately does not seed a second profile beside detected user instructions, does not advertise an unavailable import command, and prints only that existing agent instructions were detected and left unread.

The wizard derives its questions from `SeedLibrary`. It makes seven decisions: one numbered choice for each of the five axes, one numbered multi-select for all eight optional skills, and one confirmation after printing every selected title. The optional-skill response accepts `all`, `none`, or a comma-separated set of displayed numbers. There is no separate autonomy question because `question-frequency` already represents that choice.

Every parsed response is checked against a `Set<string>` built from the displayed choices. Values such as `0`, `1e0`, an unknown id, a duplicate number, a mixture containing `all`, and a partial label are rejected with a fixed retry message. End of input cancels the wizard with a fixed error and no profile write.

Selected guidance becomes global `ProfileRule` records with `source: "declared"`, `status: "active"`, zero evidence, and the entry's section and applicability. Their persistent key is `seed:<guidance-id>`. The key is assigned by the registry identity rather than visible wording, so changing a title never creates a second declared rule. Agent Skill `##` sections are demoted to `###` inside a profile rule so the profile parser keeps the full workflow under one identity.

Rerunning with the same choices produces the same visible files and ledger. A previously selected, unedited seed rule is retired when the user confirms a sibling option. A deleted selected rule stays rejected. An edited seed block is user-owned and remains verbatim even when a later selection differs. Existing imported, mined, and manual rules are outside the seed-key namespace and are never retired by the wizard.

`shadowclone wizard` runs only guidance selection and the profile update. It does not repeat capture consent. `shadowclone init` skips the wizard when a rules file is present, runs it otherwise, and always performs consent last. Only present transcript sources receive named questions. Git metadata, eval context, and deep distillation remain separate capability questions because they are not transcript provider roots.

After consent, `init` prints the existing completion message. When at least one present transcript source was enabled, it also prints a fixed invitation to run `shadowclone learn`. No learning call starts during onboarding.

## Files

| Path | Change |
| --- | --- |
| `src/cli/onboardingPresence.ts` | Reduce fixed rules and source roots to ephemeral booleans |
| `src/cli/onboardingPresence.test.ts` | Prove exact-name detection, empty-root handling, and source mapping |
| `src/cli/wizard.ts` | Derive questions, parse closed choices, confirm titles, and update the profile |
| `src/cli/wizard.test.ts` | Prove closed choice parsing, confirmation, and idempotence |
| `src/cli/wizardLifecycle.test.ts` | Prove selection changes, rejection, and user-edit preservation |
| `src/skills/profile.ts` | Map seed guidance to stable declared records and prepare lifecycle changes |
| `src/skills/index.ts` | Export the profile-selection boundary |
| `src/profile/index.ts` | Export generated state needed to distinguish selected seed records |
| `src/cli/init.ts` | Orchestrate presence, wizard or existing-rules path, then consent |
| `src/cli/init.test.ts` | Prove prompt filtering, order, config output, and the existing-rules branch |
| `src/cli/index.ts` | Route `shadowclone wizard` and update usage |
| `README.md` | Describe onboarding order, source filtering, and deliberate wizard reruns |
| `docs/architecture/01-capture.md` | Document the concrete one-entry presence check |
| `docs/architecture/02-profile.md` | Document seed selection and stable declared keys |
| `docs/architecture/README.md` | Connect the seed library to the profile through onboarding |
| `docs/design/README.md` | Register this design record chronologically |

## Data handling

Before consent, onboarding checks only fixed paths already present in `ProjectPaths` and three fixed rules filenames in the selected working directory. A directory read stops after one entry and returns only a boolean. File size is used only in the comparison that creates the boolean. No entry object, filename, path, count, size, provider-derived identifier, or content enters profile state, config, console output, or an error.

The wizard reads package-owned preference and Agent Skill Markdown through the PR 5 loader. After explicit confirmation, it writes selected titles, bodies, applicability, and fixed registry ids to the user's local profile through `writeProfile`. This is declared guidance chosen by the user, not captured machine content, so `resolveRedacted` is not part of the path.

The consent batch writes only booleans to `config.toml`. Console output contains package-owned skill titles, fixed provider questions, and fixed status messages. This change makes no network call.

## Alternatives

**Ask about every provider.** This preserves the current code but makes most users reject questions about tools they do not use. The permitted boolean presence check exists to remove that noise.

**Read rules files and import them in this PR.** Their contents are a new capture purpose and need the named `declared-rules` source, README disclosure, parsing, redaction, and repository scope defined in PR 7. Presence does not grant content consent.

**Install a recommended skill bundle.** This would label maintainer preferences as the user's declared behavior. Every axis requires an explicit choice and every optional skill is opt-in.

**Ask one yes-or-no question per optional skill.** Five axis questions, eight optional-skill questions, and confirmation would be repetitive. One numbered multi-select keeps all optional skills explicit while holding the profile portion to seven decisions.

**Generate wizard guidance with a model.** Onboarding would become slower, non-deterministic, and dependent on authentication before consent. The seed library already contains the exact readable content being selected.

## Accepted costs

The existing-rules branch does not populate a Shadowclone profile until PR 7 lands. This temporary gap is accepted because reading the file early would violate the source boundary, while running the seed wizard would mix generic choices beside rules the user already maintains.

Presence discloses locally that a supported provider has data, which PR 2 already accepts. The result exists only for the duration of `init` and is used to decide which question to display.

The numbered terminal interface is less expressive than an interactive selector. It works in every supported terminal, is deterministic under tests, and introduces no UI dependency.

Stable `seed:` keys bind declared seed rules to registry identity. Free-form user and imported rules remain independent, and editing a seed rule transfers ownership to the user through the existing profile lifecycle.

## Testing

The initialization regression test was added before implementation with only Claude Code present. It failed because `initialize` asked for Antigravity consent before any wizard decision. The completed test proves all six selection prompts and profile confirmation occur before the one relevant provider question, while absent providers are omitted.

Scratch-directory tests use secret-bearing entry and rules filenames and prove the public presence result contains only `hasRulesFile` and known source ids. Reversing the one-entry directory predicate made a populated Claude root disappear and an empty Codex root appear, causing two focused failures. Restoring the predicate returned the suite to green.

Parser fixtures reject `0`, `1e0`, duplicate choices, mixed `all`, unknown ids, and partial labels. Mutating the closed-set branch to return the first skill accepted `0` and failed the parser test. Restoring the branch returned the suite to green.

The profile integration regression selects an Agent Skill and reads the generated profile through `parseProfileRules`. Before the projection fix, the idempotence test failed because the selected skill parsed as user-edited instead of declared. Demoting its workflow sections to `###` made the same test pass while preserving the portable `SKILL.md` source.

The updated parsing, confirmation, idempotence, lifecycle, and onboarding-order suites pass 13 focused tests with 61 expectations. `bun run check` passes 265 tests across 71 files with 1,446 expectations, along with type checking, Biome, and repository convention checks. The production bundle builds at 296 KB. The bundled wizard accepted all six selection responses, printed five selected titles, reached confirmation, and wrote nothing when declined. The package dry run contains all eight preferences and ten Agent Skills.

## Open questions

None.

## Decision record

2026-09-08: Ask seven profile decisions before capture consent because the user should understand the result before deciding what local data may produce evidence.

2026-09-08: Detect exact rules filenames but leave their contents unread because presence is permitted in PR 2 and import consent belongs to PR 7.

2026-09-08: Derive every guidance choice from the packaged registry because a second hardcoded question-to-rule mapping would drift.

2026-09-08: Use stable `seed:<guidance-id>` profile keys because registry identity must survive wording changes and enable later axis reconciliation.

2026-09-08: Ask only about present transcript sources because absent provider questions add friction without granting useful consent.

2026-09-08: Keep `wizard` separate from consent on rerun because changing declared behavior does not imply changing capture permissions.
