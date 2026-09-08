# Align capture consent and capability claims

## Summary

Shadowclone permits a boolean presence check for a disabled capture source while keeping its contents, entry names, paths, and metadata behind explicit consent. The public documentation states the product mission and implemented capabilities without claiming an unpublished evaluation result, distinguishes owner-scoped profile rules from repository-scoped action policy, documents the profile edit and deletion lifecycle, and says which installed artifacts `forget --all` leaves behind. A chronological design index and maintained Mermaid architecture diagram give later changes one place to record their reasoning and system impact.

## Problem

The capture rule treats checking whether a configured source root exists as equivalent to reading its contents. The planned onboarding flow therefore cannot avoid asking about providers that are not installed, even though it needs only a boolean and must not learn a project slug, repository name, transcript name, or transcript content before consent.

The README says users "see a measurable action delta" without a published run, denominator, engine, model, or uncertainty rate. It says the default dispatch path "runs verification checks," while `detectVerificationTools` only grants matching command patterns to the engine and `runHeadlessClone` never requires evidence that one ran. It describes profile rules as repository-scoped even though `normalizeRemoteOrigin` deliberately resolves `host/owner`. Repository action policy uses the separate `RepositoryIdentity.id` with `host/owner/repo`.

The README tells users that `forget --all` wipes the entire local installation. The command removes `~/.shadowclone/`, but `installLiveClone` also writes `.claude/agents/shadowclone.md`, `.claude/skills/shadowclone/SKILL.md`, and `.git/info/exclude` entries inside a repository. The README also omits the implemented edit-to-pin and delete-to-reject behavior in `writeProfile`.

Design records have no chronological index, and the architecture overview uses an ASCII pipeline that does not show the engine dependency or the two live and headless clone paths. The contributor rules say design documents exist but do not require each change to start from one or to assess documentation and diagram impact.

## Prerequisites

PR 1 must remain below this change because the capability documentation relies on repository identity coming from the parsed git remote rather than the checkout directory name.

The consent amendment must land in `CLAUDE.md`, `.claude/skills/data-handling/SKILL.md`, `docs/architecture/01-capture.md`, `docs/architecture/05-privacy.md`, and `README.md` together. Leaving one behind gives future agents two incompatible rules.

## Design

Capture consent protects content. Before consent, Shadowclone may determine whether a configured source root exists and whether it contains at least one entry. The result is one boolean used only during the current onboarding flow. The check may not collect or inspect entry names, open an entry, inspect metadata beyond what the boolean needs, or retain or log a path, name, count, timestamp, or provider-specific identifier. Content access remains a named capture source that defaults to off.

The README opens with the clone mission: Shadowclone learns how a developer works so coding agents can work more like them. Reconciliation between written instructions and observed corrections is described as the next milestone, while the current pipeline and evaluation command are described as implemented instruments rather than validated outcomes.

One provider capability matrix records observation, deep distillation, live clone, headless dispatch, and transfer evaluation separately. Claude Code implements all five. Codex implements observation, distillation, and transfer evaluation. Cursor implements observation and distillation. Antigravity implements observation. Authentication and real-corpus verification remain manual checks and are stated separately from implementation.

Profile scope and action scope use their actual identifiers. Learned profile rules are stored under `host/owner` and may promote to global after evidence from two owners. Repository action configuration uses `[repo."host/owner/repository"]` and requires `git-metadata`. Without it, `resolveRepository` returns an isolated identity, so that repository entry cannot match.

The dispatch description says the engine receives detected verification command permissions. It does not say those commands are executed or checked. Host-enforced verification remains future dispatch lifecycle work.

The profile section explains that editing generated visible text pins the block and preserves it verbatim, while deleting a generated block records its key in `.rejected` and prevents the same key from being generated again. The retention section says `forget --all` removes Shadowclone's home data and leaves repository-local installed files and exclude entries until uninstall support lands.

`docs/design/README.md` lists design records in chronological order with their date, status, and decision. Contributor rules require a design record before implementation, final validation in the same record, and a documentation-impact check in every PR. The architecture overview uses Mermaid and contributor rules require updating it when stages, dependencies, trust boundaries, or execution paths change.

## Files

| Path | Change |
| --- | --- |
| `docs/design/005-capture-and-capability-truth.md` | Record this decision and its verified basis |
| `docs/design/README.md` | Index design records chronologically and define the per-change workflow |
| `CLAUDE.md` | Amend capture consent and require design and documentation continuity |
| `.claude/skills/data-handling/SKILL.md` | Permit bounded boolean presence checks before content consent |
| `README.md` | State the mission, current capabilities, scoping, profile lifecycle, dispatch limit, and incomplete uninstall behavior |
| `docs/architecture/README.md` | Replace the ASCII pipeline with the maintained Mermaid architecture diagram |
| `docs/architecture/01-capture.md` | Apply the content-based consent boundary to source discovery |
| `docs/architecture/02-profile.md` | Clarify owner-level scope and the exact pin and rejection lifecycle |
| `docs/architecture/04-acting.md` | State the `git-metadata` prerequisite and the advisory verification behavior |
| `docs/architecture/05-privacy.md` | Record the consent amendment and its accepted disclosure |

## Data handling

This PR changes the rule governing future source discovery but adds no runtime read, storage, log, or network path. The newly permitted pre-consent result is one boolean stating that a configured source root exists and is non-empty. Entry names, nested paths, counts, timestamps, metadata, and contents remain protected. No captured data is materialized, so `resolveRedacted` is not reached and no new egress exists.

## Alternatives

**Keep every presence check behind source consent.** Rejected because onboarding must ask about every possible provider, including providers that are absent, while protecting no transcript content or identifying entry name.

**Enumerate a disabled source so onboarding can describe what was found.** Rejected because a directory entry can contain an employer or repository slug. The boolean supplies the needed branch without widening the disclosure.

**Leave current capability claims until the reconciliation milestone is complete.** Rejected because the README currently states an unmeasured outcome and an unenforced verification guarantee. Documentation describes the software that exists at each commit.

**Require an arbitrary documentation edit in every PR.** Rejected because unrelated edits create noise. Every PR assesses documentation impact and changes only the documents affected by its decisions or behavior.

## Accepted costs

A pre-consent presence check reveals that a supported provider has local data on the machine. That disclosure is accepted because the onboarding flow is about to ask whether to use that provider, while all identifying content remains unread.

The capability matrix is maintained manually and can drift from `src/provider/registry.ts` and evaluation engine support. The per-change design and documentation check makes that drift a review failure until a generated public matrix is justified.

The README will change again as reconciliation, uninstall, and host-enforced verification land. Accurate temporary limitations are preferred over promises based on planned work.

## Testing

Verify every capability cell against `src/provider/registry.ts`, `src/cli/transferEval.ts`, the Claude plugin, and the dispatch engine requirements. Verify scope claims against `normalizeRemoteOrigin`, `normalizeRemoteRepository`, `profileRulePath`, `allowedProjectFile`, and repository policy lookup. Verify lifecycle claims against `parseProfileBlocks` and `writeProfile`. Verify the wipe limitation against `installLiveClone` and `forgetAll`.

Run `bun run check` after all documentation changes. No runtime regression test or mutation step applies because this PR changes no executable behavior. Scan every changed prose file for em dashes and render the Mermaid diagram in GitHub's parser through the pull request view.

## Open questions

None.

## Decision record

2026-09-08: Permit only an ephemeral boolean source-root presence result before content consent, so onboarding can omit absent providers without reading their identifying data.

2026-09-08: Describe evaluation as an implemented instrument until a fully reported run produces a result.

2026-09-08: Document owner-level profile scope separately from repository-level action policy because the code uses different identities for them.

2026-09-08: Require one design record and one documentation-impact assessment per change, and update the architecture diagram only when the system shape changes.
