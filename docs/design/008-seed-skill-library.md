# Seed guidance library

## Summary

Ship eight concise profile preferences and ten complete Agent Skills as package-owned Markdown. Validate both forms as one typed seed library and expose them through `shadowclone skills` without treating a preference sentence as a skill.

## Problem

Shadowclone needs useful starting behavior for a user who has no existing agent instructions. The first implementation put 20 flat Markdown files under `skills/`, and each file contained one profile-shaped paragraph. Those paragraphs could express a preference, but they did not give an agent a repeatable method for completing a task.

The first library also promoted this repository's zero-comment convention into a general onboarding choice. That convention is unusually strict, and the two alternatives in the same axis were compatible with each other rather than mutually exclusive. The resulting question did not represent a sound general preference axis.

## Prerequisites

PR 3 provides persistent profile fields for declared guidance, including `source`, `status`, and `applies-when`. PR 4 isolates model-backed learning. The seed library itself stays offline and package-owned.

## Design

The library has two explicit kinds of guidance.

A profile preference is a short, persistent choice about how the clone should behave across tasks. Preferences live under `preferences/<id>.md`, use the existing profile-block shape, and always belong to an axis. Shortness is appropriate because the file records a choice rather than teaching a procedure.

An Agent Skill is a task-specific procedure or reference that changes how the clone works when a matching situation arises. Skills follow the open Agent Skills directory shape at `skills/<name>/SKILL.md`. Each one has a routing description, specific trigger, ordered process, guardrails, and a checkable completion condition. Length follows the work required by the skill; filler and generic advice remain invalid.

The distinction follows the information hierarchy described by Matt Pocock's [`writing-for-agents`](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md) skill and the [Agent Skills specification](https://agentskills.io/specification). Skill metadata is cheap discovery context, the `SKILL.md` body loads for the matching task, and optional resources load only when a branch needs them.

### Profile preferences

The four preference axes are:

| Axis | Choices |
| --- | --- |
| `dependency-posture` | Prefer the existing stack / adopt mature focused dependencies |
| `planning-threshold` | Plan before changing code / plan only costly changes |
| `question-frequency` | Ask when intent is unclear / use judgment and keep moving |
| `refactor-tolerance` | Preserve local structure / refactor when boundaries improve |

The comment-policy axis is removed. Shadowclone can learn a user's comment conventions from imported rules and later evidence without offering an uncommon repository rule as a general default.

### Agent Skills

The package ships ten Agent Skills:

| Skill | Kind | Purpose |
| --- | --- | --- |
| `testing-first` | `testing-approach` axis | Run a vertical red-green cycle through a public seam |
| `testing-risk-based` | `testing-approach` axis | Choose tests from concrete regression risk |
| `diagnose-before-editing` | independent | Reproduce, isolate, explain, then fix a defect |
| `research-primary-sources` | independent | Resolve an implementation question against authoritative evidence |
| `prove-regression-tests` | independent | Demonstrate that a regression test detects the removed defect |
| `design-deep-modules` | independent | Place complexity behind a small, testable interface |
| `resolve-conflicts-by-intent` | independent | Resolve each conflict from both changes' original intent |
| `scope-confirmed-changes` | independent | Keep fixes tied to reachable behavior and requested outcomes |
| `typescript-type-safety` | independent | Preserve value relationships and valid state in TypeScript |
| `verify-and-review` | independent | Run relevant checks and inspect the final diff before handoff |

Testing approach remains an axis because its two complete workflows make different choices about when the test is written. The other eight skills are independently selectable.

### Skill format

Every skill uses standard `name` and `description` frontmatter. Shadowclone-specific fields live as strings inside the standard `metadata` map: `shadowclone-category`, `shadowclone-section`, `shadowclone-applies-when`, and optional `shadowclone-axis`.

The body starts with one H1 title and contains `## Use when`, `## Process`, `## Guardrails`, and `## Completion` sections. Process steps describe observable actions in order. Completion states evidence an agent can inspect rather than a vague claim that the work is done.

No content is copied from Matt Pocock's repository. Its structure and quality criteria inform original Shadowclone skills.

### Loading and inspection

`loadSeedLibrary` resolves both package directories from the source tree or built package. It reads `preferences/*.md` and `skills/*/SKILL.md`, sorts paths, parses unknown YAML through strict Zod schemas, and rejects duplicate ids, unknown metadata, path-name mismatches, title mismatches, missing skill sections, or axes with fewer than two choices.

The result exposes all guidance, preferences, Agent Skills, axes, and independent skills with names that preserve the distinction. `shadowclone skills` prints preference axes first, skill axes second, then independent skills. It lists ids and titles only and reads no user state.

## Files

| Path | Change |
| --- | --- |
| `preferences/*.md` | Store eight short profile choices under four axes |
| `skills/*/SKILL.md` | Store ten standard task-specific Agent Skills |
| `src/skills/schema.ts` | Define the preference, Agent Skill, and library types |
| `src/skills/parse.ts` | Parse both strict document forms |
| `src/skills/index.ts` | Resolve package paths and build the combined library |
| `src/skills/index.test.ts` | Prove standard layout, complete workflows, ids, and axes |
| `src/cli/skills.ts` | Render preferences and skills as separate groups |
| `src/cli/skills.test.ts` | Prove every packaged entry is visible once |
| `package.json` | Publish both package-owned guidance directories |
| `README.md` | Explain the preference and skill distinction |
| `docs/architecture/02-profile.md` | Place both seed forms upstream of declared profile records |
| `docs/design/README.md` | Keep this correction active until validation completes |

## Data handling

The loader reads package-owned Markdown only. It does not inspect a user's profile, repository instructions, transcripts, home directory, or provider state. The CLI logs package-owned ids, titles, and axis names. It makes no network call and writes no file.

## Alternatives

**Make every file longer.** Length alone does not make a skill useful. It would preserve the category error and add context without adding a repeatable method.

**Rename every existing file to a preference.** This would make the short entries honest, but it would leave onboarding without reusable task methods.

**Keep the comment axis with a milder first choice.** The remaining choices still overlap, and repository comment practice is better learned from repository guidance than selected as a global seed.

**Copy established third-party skills.** This would inherit another author's workflow and licensing surface instead of creating behavior that can be selected, edited, and reconciled by Shadowclone.

## Accepted costs

The package grows because useful procedures contain more than one rule. Progressive disclosure limits the runtime cost: descriptions support routing and full bodies are intended for matching tasks.

The combined library has 18 entries rather than the original 20. Count is no longer a target. Every entry must earn its place by expressing either a real choice or a method that changes agent behavior.

## Testing

The regression test expected ten standard `skills/<name>/SKILL.md` paths and no `comments-none` entry. Against the flat library it failed with zero standard skill files before implementation.

Parser fixtures cover unknown standard frontmatter, invalid Shadowclone metadata, path-name mismatch, missing required workflow sections, duplicate YAML keys, and duplicate ids. Removing the `Guardrails` requirement made the incomplete-workflow fixture fail. Adding a valid `comments-none` preference made the explicit exclusion test fail. Both tests passed again after restoring the intended behavior.

`bun run check` passes 255 tests across 68 files with 1,402 expectations, along with type checking, Biome, and repository convention checks. The production bundle builds at 291 KB. The source and built `shadowclone skills` commands print the same four preference axes, one skill axis, and eight optional skills. `npm pack --dry-run --json` includes all eight preference files and ten standard Agent Skill files.

## Open questions

None.

## Decision record

2026-09-08: Keep seed guidance package-owned and offline so onboarding remains deterministic.

2026-09-08: Correct the initial library after review because a profile sentence and an Agent Skill have different jobs.

2026-09-08: Remove comment policy because the zero-comment option came from one repository and the remaining options were not exclusive.

2026-09-08: Follow the open Agent Skills directory and frontmatter shape so packaged skills are portable and inspectable.

2026-09-08: Require process, guardrails, and completion evidence so every skill changes an agent's behavior rather than restating a broad preference.
