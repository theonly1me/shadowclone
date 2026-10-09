# Working on Shadowclone

Shadowclone maintains portable coding-agent skills from consented sessions and memory. Active installations deliver skills and small native instruction sections; legacy profiles remain for migration.

## Read first

- Follow the code conventions in `CONTRIBUTING.md` when you edit code or prose.
- Read `.claude/skills/data-handling/SKILL.md` before changing capture, storage, model access, or actions performed for the user.

## Work on the requested change

Inspect the current worktree and preserve unrelated edits. Record the change’s reasoning and sequence in `docs/` before implementation. Use an existing record when extending the same design.

Keep types and names explicit. Use Bun, the existing module boundaries, and the repository’s checks. Avoid introducing dependencies without a concrete reason.

Keep active skills delivery separate from legacy profile compatibility. Do not inject an aggregated profile into an active skill environment.

## Checks

```bash
bun install
bun run check
bun test src/skills
bun run cli --help
```

`bun run check` runs typecheck, lint, and tests. Run focused checks while editing and the full gate before handoff. Report pre-existing failures separately. Tests use synthetic fixtures; authenticated agent runs and paid evaluations require an explicitly authorized scope.

## Data boundaries

- Keep private repository material, transcripts, receipts, and identifying paths outside this public checkout, including ignored files. Use independently authored synthetic examples.
- Public evaluation material may name models and versions, but not evaluator identities, billing details, private installations, paths, or repositories. An evaluation of public code may name its public source and evaluation repositories.
- Each capture source needs its own consent flag, off by default. Document additions in `docs/data-handling.md`.
- Resolve eligible learning text through `resolveRedacted`. Exclude tool results, tool-returned file contents, thinking blocks, and data-access results from learning.
- Preserve repository and remote-owner scope. Global guidance needs explicit global evidence or a direct user decision.
- Preserve manual edits and ownership checks when writing skills or native instructions. Keep changes reversible.

## Documentation

Use [the documentation index](docs/README.md) to find user guides, architecture, and design history. Update the pages affected by a behavior change. Update the architecture diagram when the flow or a trust boundary changes.

Write for the page’s reader. Remove session narration, expired task instructions, and duplicate explanations. Keep current instructions accurate and identify historical designs as history.

Keep the README a short path to a working setup: a quick start with time estimates, plain-language results, and a privacy summary. Put usage detail in `docs/guides/` and link to migration, architecture, and detailed evaluation methods. User-facing commands use the installed `shadowclone` CLI; Bun commands belong in contributor instructions.

## Handoff and Git

Explain what changed, how it was verified, and any remaining limitation. Commit, push, and open a draft pull request without stopping for a diff review. Check `gh pr view --json state` before you push to a branch that has a pull request. Commit messages use a single lowercase conventional-commit subject with no body or co-author trailer. Pull request titles use the same format, such as `fix: keep cursors after a failed index`. Squash merges use the title as the commit subject on `main`, and Release Please creates releases only from conventional commits. Never force push or amend a pushed commit.


<shadowclone-guidance>
## Your agent build

Follow repository requirements. Repository build choices override personal global choices. Load each selected workflow skill at the moment listed for it. When a selected workflow skill conflicts with the user's own skills or learned baseline rules, follow the user's guidance.
- when a change adds a skip, block, fallback, default, or retry: choose-by-consequence
- when designing or reshaping a module or subsystem: design-deep-modules
- when behavior is wrong or slow and the cause is not known: diagnose-before-editing
- before a change that has many steps or open design choices: plan-with-review-page
- when a decision depends on facts outside the repository: research-primary-sources
- while a merge, rebase, or cherry-pick has conflicts: resolve-conflicts-by-intent
- when fixing a bug, a regression, or a confirmed review finding: scope-confirmed-changes
- when a pull request needs a review: shadowclone-review
- when taking a change or a pull request to ready for review: shadowclone-work
- when adding, changing, or proving a test: tests-that-catch-bugs
- when changing TypeScript types or input that enters typed code: typescript-type-safety
- before you say that work is done or ready for review: verify-and-review
- before you write any text that a person reads: write-plain-english
Follow the selected working preferences in the shadowclone-build-preferences skill when relevant.
</shadowclone-guidance>
