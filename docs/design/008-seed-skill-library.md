# Seed skill library

## Summary

Ship 20 readable behavioral skills as package-owned Markdown, validate them as one typed library, and expose the library through `shadowclone skills`. The library gives the next onboarding change a finite set of user-selectable dispositions without replacing the editable profile format.

## Problem

Shadowclone can persist declared profile rules, but it has no starting vocabulary for a user who has not written agent instructions. The planned wizard therefore has nothing stable to present, axis conflicts have no named alternatives, and malformed packaged guidance would fail only after installation.

The current package publishes `bin`, `dist`, plugin metadata, and top-level documentation. It does not publish behavioral content or expose a command that lets a user inspect what a later wizard can install.

## Prerequisites

PR 3 provides the persistent profile fields that seed skills map to, including `source`, `status`, and `applies-when`. Without that schema, selecting a skill would require a second representation or would discard its applicability.

PR 4 isolates model-backed learning. The seed library itself is offline, but later reconciliation compares its declared rules with learned evidence under that execution contract.

## Design

The repository gains exactly 20 Markdown files under `skills/`. Each document contains YAML frontmatter followed by one profile-shaped block. The visible heading must equal the frontmatter title and the filename must equal `<id>.md`.

```markdown
---
id: comments-none
title: Write no comments
axis: comment-policy
category: communication
section: engineering
applies-when:
  - writing or editing code
---
## Write no comments

Write code whose names and structure carry the explanation. Do not add comments.
```

`axis` is either one kebab-case identifier or `null`. A non-null value makes the skill one option on a mutually exclusive question. `null` makes it an independent discipline. A scalar field makes membership in two axes unrepresentable. `category` is an open kebab-case topic for display and future community packs. `section` uses the existing `ProfileSection` values. `applies-when` is a non-empty list of plain conditions that the profile compiler will consume in PR 10.

The six axes and their options are fixed for this seed library:

| Axis | Skill ids |
| --- | --- |
| `comment-policy` | `comments-none`, `comments-why`, `comments-public` |
| `testing-approach` | `testing-first`, `testing-risk-based` |
| `planning-threshold` | `planning-first`, `planning-when-costly` |
| `question-frequency` | `questions-early`, `questions-autonomous` |
| `refactor-tolerance` | `refactor-preserve`, `refactor-boundaries` |
| `dependency-posture` | `dependencies-existing`, `dependencies-mature` |

The seven disciplines are `investigate-before-editing`, `scope-confirmed-changes`, `verify-and-review`, `prove-regression-tests`, `design-deep-modules`, `resolve-conflicts-by-intent`, and `typescript-type-safety`. Investigation covers systematic debugging, root-cause analysis, and research in unfamiliar systems. Verification includes self-review. The TypeScript discipline carries `language=typescript` rather than applying language-specific rules to every project.

Every body describes behavior that applies while work is already underway. No skill starts an orchestration flow, defines a slash command, or tells the user how to invoke the product. This excludes task commands such as implementation, ticket conversion, triage, and repository tours.

`loadSeedSkillLibrary` resolves `skills/` from either the source tree or the built package, reads only `.md` files, and sorts filenames before parsing. Bun's YAML parser produces unknown input, then a strict Zod object accepts only `id`, `title`, `axis`, `category`, `section`, and `applies-when`. The loader rejects an unknown field, malformed slug, empty applicability, filename mismatch, title mismatch, duplicate id, or an axis with fewer than two choices. Errors name the packaged filename and never include document contents.

The loader returns all skills, axes with their options, and disciplines. `shadowclone skills` renders the six axes first and the independent disciplines second. It lists ids and titles only, which makes the command deterministic and keeps the full prose in the Markdown files users can inspect.

The package manifest includes `skills`. The built CLI resolves the sibling package directory, while source execution resolves the repository root. A built-command smoke check proves both layouts instead of assuming bundler behavior.

## Files

| Path | Change |
| --- | --- |
| `skills/*.md` | Add the 20 seed dispositions in the profile block format |
| `src/skills/schema.ts` | Define strict metadata validation and public types |
| `src/skills/parse.ts` | Parse one Markdown document and enforce filename and heading identity |
| `src/skills/index.ts` | Resolve package paths, load the full library, and validate axes and ids |
| `src/skills/index.test.ts` | Load every packaged skill and reject malformed registry fixtures |
| `src/cli/skills.ts` | Render and print the deterministic skill listing |
| `src/cli/skills.test.ts` | Prove every packaged skill is visible through the command renderer |
| `src/cli/index.ts` | Route `shadowclone skills` and add it to usage |
| `package.json` | Publish the root `skills` directory |
| `README.md` | Document the inspection command and the library's role |
| `docs/architecture/02-profile.md` | Place seed skills upstream of declared profile rules |
| `docs/design/README.md` | Register this design record chronologically |

## Data handling

The loader reads package-owned Markdown only. It does not inspect a user's profile, repository instructions, transcripts, home directory, or provider state. The CLI logs packaged ids, titles, and axis names. It makes no network call and writes no file.

## Alternatives

**Hardcode the library in TypeScript.** This would make wording changes harder to review, prevent users from reading the shipped source as ordinary Markdown, and require rebuilding community packs.

**Ship one recommended bundle.** This would turn the maintainer's preferences into the user's identity. Named axes preserve strong positions while requiring the user to choose among them in the later wizard.

**Ship orchestration commands beside dispositions.** Commands answer what operation to run, while this library answers how an agent behaves during work. Mixing them would give `applies-when` two meanings and make transcript reconciliation ambiguous.

**Add a YAML dependency.** Bun 1.4.2 already exposes `Bun.YAML.parse`, so another parser adds install and audit cost without adding a capability.

## Accepted costs

Twenty files add content-review surface and some package size. The count is accepted because loader complexity does not grow with it, all six axes retain real alternatives, and the user explicitly selected 20 seed skills.

Axis and category identifiers are strings rather than a closed TypeScript enum so later community packs do not require a code release. Runtime validation still requires kebab-case values and at least two options for every represented axis.

The initial CLI lists skills but does not install them. Profile writes and user confirmation belong to PR 6, so this PR remains additive and cannot alter a user's clone behavior.

## Testing

Add the package-library test before the loader and run it against the branch head. It must fail because `src/skills` and `skills/` do not exist. Add a malformed fixture with an unknown `command` field and prove strict parsing rejects it, then mutate the schema to accept unknown fields, print the changed line, and confirm the fixture fails for the intended reason.

The complete-library test asserts 20 unique ids, six axes, at least two options per axis, one axis assignment per axis skill, non-empty applicability, matching filenames and headings, and seven disciplines. The CLI test asserts every skill id and title appears exactly once in the rendered output.

Run `bun run check`, `bun run build`, and the built `dist/shadowclone.js skills` command. Inspect the package dry-run file list and confirm all 20 root skill files ship.

## Open questions

None.

## Decision record

2026-09-08: Ship exactly 20 seed skills because the user selected that count and content volume does not change later machinery.

2026-09-08: Represent six questions as axes and seven behaviors as disciplines so strong preferences are selected rather than imposed.

2026-09-08: Keep each skill in Markdown with strict YAML frontmatter because it is profile prose that users and contributors should be able to read and diff.

2026-09-08: Infer skill kind from nullable scalar `axis` because a separate kind field would duplicate the same state and allow disagreement.

2026-09-08: List skills without installing them because consented profile writes belong to the onboarding PR.
