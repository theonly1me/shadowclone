# Import Existing Repository Guidance

## Summary

Shadowclone imports supported repository instruction files as stable profile rules so an agent can inherit declared project behavior without asking the user to restate it. The import remains local, redacts content before storage, preserves user edits and rejections across reruns, and scopes repository-specific guidance to the repository that supplied it.

## Problem

Repositories already express working conventions in `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.claude/skills/*/SKILL.md`, and `.agents/skills/*/SKILL.md`, but Shadowclone currently detects only three root files and deliberately leaves them unread. A user must repeat existing guidance through the seed wizard or later learning, imported guidance cannot follow the profile lifecycle, and repository-specific rules cannot be compiled into only their owning repository. Reading these files before consent would violate the source boundary, while treating every heading as a separate profile rule would fragment a single authored instruction into unrelated records.

## Prerequisites

Design record 006 provides stable rule keys, generated-state tracking, edit preservation, rejection persistence, and retirement for removed generated rules.

Design record 009 provides the prompt abstraction and onboarding flow that can ask for declared-rule consent before any repository guidance content is read.

The `FileTextRef` and `resolveRedacted` boundary remains the only path from a repository file to stored profile text.

## Design

The source registry gains `declared-rules`, disabled by default. Existing configuration files that omit it continue to parse with the source disabled. Managed policy can prohibit it independently from Git metadata and transcript sources. The public `shadowclone import` command checks managed policy and the persisted source flag before discovery reads content. When the source is disabled, it prompts once; declining exits successfully without reading repository guidance or writing configuration or profile state, while accepting persists the flag before import begins.

Preconsent onboarding checks only whether a supported root file exists or either supported skill root contains at least one direct skill entry. It produces one boolean and does not read file contents, names, directory names, sizes, or metadata beyond the minimum existence and nonempty checks allowed by the capture boundary. With detected guidance, `shadowclone init` asks whether to import it. Acceptance skips seed selection, records consent, writes configuration, and then imports. Declining or a managed-policy block offers the seed wizard as a separate choice. Repositories without detected guidance keep the existing wizard-first flow.

Postconsent discovery accepts exactly the root files `CLAUDE.md`, `AGENTS.md`, and `.cursorrules`, plus direct `.claude/skills/*/SKILL.md` and `.agents/skills/*/SKILL.md` files. It excludes deeper entries, unrelated files, and generated Shadowclone skill directories. Supported entries must be regular files and their parent skill entries must be real directories. Symlinks and other unsupported entry types fail with fixed messages that do not expose captured paths. Discovery sorts the fixed relative identifiers, rejects batches above 256 files or 2,000,000 total bytes, and validates the complete batch before resolving any content or writing profile state.

Each supported file becomes one imported profile rule. Root files receive fixed titles. A skill file uses its redacted first Markdown level-one heading when present and a fixed fallback otherwise. Valid leading skill frontmatter is removed from the stored body. Remaining Markdown headings are nested beneath the profile rule heading, while headings inside fenced code remain unchanged, so the profile parser never splits one imported source into several rules. Content is read through `FileTextRef` and `resolveRedacted`; unredacted file text is neither returned from the import boundary nor persisted. Import does not call a model or a network service.

Imported rules have source `imported`, active status, empty evidence, and no proposal. Profile rule location becomes a discriminated shape: global rules have no origin or repository name, organization rules require an origin directory, and project rules require both an origin directory and a safe repository profile name. A repository with an allowed Git identity stores imported guidance under `org/<origin>/projects/<safe-name>--<identity-hash>.md`. A working directory without Git metadata keeps guidance in its existing opaque isolated organization scope. The safe name normalizes repository display characters and appends a hash of the full repository identity, preventing traversal and collisions. Compilation includes a project file only when its exact safe name matches the active repository.

Profile metadata, `.generated`, and `.rejected` entries gain an import reference containing repository aliases and a source locator. Each alias is a hash of either the canonical working directory or normalized remote repository identity. The source locator is a hash of the normalized supported relative path. Raw paths and remote identifiers never enter profile or lifecycle state. The first import assigns a UUID rule key. Later imports match when a stored alias intersects the current aliases and the source locator matches, then reuse the same key and merge aliases. Enabling Git metadata promotes an unedited isolated rule into project scope under the same key, and a second checkout of the same remote can reuse the remote alias.

Import builds and validates its full incoming rule set before calling `writeProfile`. A changed source replaces generated text under the same key. A user-edited profile block remains unchanged. A deleted imported block remains rejected. A source removed from the repository retires only an unedited generated block. A rename retires the old identity and creates a new identity. Repeating an unchanged import produces byte-identical profile and lifecycle files.

The command reports only aggregate imported, preserved, rejected, and retired counts. Logs and errors never include source paths, headings, bodies, repository remotes, or repository names derived from captured material.

## Files

| Path | Change |
| --- | --- |
| `src/config/schema.ts` | Add the backward-compatible `declared-rules` source flag |
| `src/config/managed.ts` | Apply managed-policy restrictions to the new source |
| `src/onboardingPresence.ts` | Detect only a preconsent supported-guidance boolean |
| `src/cli/init.ts` | Add import-first onboarding and seed fallback behavior |
| `src/cli/import.ts` | Implement the public consent and import command flow |
| `src/cli/index.ts` | Register `shadowclone import` and update usage |
| `src/importRules/discovery.ts` | Discover and validate the bounded supported source set |
| `src/importRules/markdown.ts` | Produce one safe profile body and title per source file |
| `src/importRules/identity.ts` | Hash opaque repository aliases and source locators |
| `src/importRules/importRepositoryGuidance.ts` | Build stable imported rules and invoke profile lifecycle writes |
| `src/profile/types.ts` | Add project locations and opaque import references |
| `src/profile/metadata.ts` | Parse and render backward-compatible import metadata |
| `src/profile/path.ts` | Route project rules to exact safe repository profile files |
| `src/profile/lifecycle.ts` | Preserve import identity through edits, rejections, moves, and retirement |
| `src/profile/compile.ts` | Compile only the current repository's exact project file |
| `src/repository.ts` | Derive a traversal-safe, collision-resistant project profile name |
| `README.md` | Explain repository guidance import and its consent boundary |
| `docs/consent.md` | Document declared-rule consent and managed-policy behavior |
| `docs/quickstart.md` | Add init and standalone import paths |
| `docs/profile-lifecycle.md` | Explain imported rule synchronization and rejection behavior |
| `docs/architecture.md` | Show discovery, redaction, profile lifecycle, and project compilation |
| `docs/design/README.md` | Register this design and its implementation status |

## Data handling

Before consent, Shadowclone stores only the existing aggregate supported-guidance presence boolean in memory for the duration of initialization. After consent, it reads only fixed supported repository files. Every file is represented as a `FileTextRef`, resolved through `resolveRedacted`, and transformed only after redaction. Stored profile bodies therefore contain redacted text. Profile metadata and lifecycle state contain hashes of repository aliases and source-relative locators, never raw filesystem paths, remote URLs, repository names, instruction titles, or unredacted bodies beyond the already redacted profile content. The feature performs no network call and adds no telemetry. Aggregate command output contains counts only.

## Alternatives

**Learn repository guidance through the semantic distiller.** This adds model cost, nondeterminism, and another egress path to content the repository has already declared explicitly. Direct deterministic import preserves the authored behavior and keeps the consent boundary auditable.

**Create one profile rule per Markdown section.** This makes authored files unstable under heading edits, lets fenced examples create false rules, and fragments context that was written as one instruction. One source file remains one lifecycle identity.

**Store raw source paths and Git remotes for synchronization.** This makes state easy to inspect but persists repository and workstation identifiers that the profile does not need. Opaque aliases provide stable matching without that disclosure.

**Import every agent configuration format recursively.** This creates an unbounded capture surface and makes consent too vague. The first version supports a fixed cross-agent set with explicit depth and size limits.

**Overwrite imported profile blocks on every run.** This destroys profile edits and turns synchronization into a competing source of truth. Existing lifecycle semantics continue to treat profile edits and deletions as user decisions.

## Accepted costs

Two checkouts of the same repository cannot share imported identity until Git metadata is enabled because no shared repository alias is available.

Renaming a supported source retires the old generated rule and creates a new key because the source locator intentionally identifies the authored file.

The Markdown transformer implements only the fence, frontmatter, and heading behavior needed to keep one imported source in one profile block. It does not attempt to normalize arbitrary Markdown.

Tracking opaque import references in lifecycle state expands the profile schema and keeps state for edited imported blocks so later synchronization can honor those edits.

## Testing

An initialization regression test is written first and demonstrates the current behavior failing because detected repository guidance does not offer import.

Command tests verify decline without content, configuration, or profile reads; acceptance persistence; managed-policy denial; repeat execution without another prompt; and aggregate-only output.

Discovery tests cover all three root files, both skill roots, nested and unrelated exclusions, generated-skill exclusion, symlinks, unsupported entries, more than 256 files, more than 2,000,000 bytes, and absence of partial profile writes after any validation failure.

Markdown tests cover leading frontmatter, a redacted skill heading, multiple heading levels, fenced fake headings, and one resulting profile rule per source file. A planted-secret test verifies the secret is absent from profiles, state, logs, and errors. The public import test is mutation-checked by temporarily bypassing `resolveRedacted`, confirming that the test fails, and restoring the boundary.

Lifecycle tests verify byte-stable reruns, source updates under the same key, preserved profile edits, persistent deletion rejection, retirement after source removal, rename behavior, isolated-to-project promotion under the same key, remote alias reuse across checkouts, and exact project-only compilation. Repository identity tests use malicious remote names to prove all resolved profile paths remain within the profile root.

Initialization tests verify that import acceptance skips the seed wizard, import decline offers it, managed-policy denial offers it, and a repository without instructions retains wizard-first behavior.

Final verification runs `bun run check`, `bun run build`, public CLI help and import smoke tests, package-content inspection, documentation link checks, architecture rendering inspection, and a search for captured values in command output and persisted lifecycle state.

## Open questions

None.

## Decision record

Import one rule per supported source file so authored context and lifecycle identity remain stable.

Require explicit `declared-rules` consent and allow managed policy to deny the source.

Detect only an aggregate presence boolean before consent and read content only after consent.

Support a fixed cross-agent source set with one-level skill discovery and bounded batch limits.

Synchronize deterministic redacted content through the existing profile lifecycle without model calls.

Identify imports with hashed repository aliases and hashed source locators so synchronization stores no raw repository identifiers.

Store Git-identified guidance in an exact project profile file and keep no-Git guidance in isolated organization scope.

Preserve profile edits and deletions as user decisions while retiring removed unedited sources.
