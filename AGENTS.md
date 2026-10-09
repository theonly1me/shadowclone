# Working on Shadowclone

Shadowclone maintains portable coding-agent skills from consented sessions and memory. It delivers skills and small native instruction sections. Legacy profiles remain for migration.

## Layout

- `packages/*`: the `@shadowclone/<name>` packages. The [architecture](docs/architecture/README.md) shows how they depend on each other.
- `skills/`, `preferences/`, `plugins/`: bundled content. People and skill installers look for it at the root.
- `evals/` and `tooling/`: private workspaces for evaluation suites and repository checks.
- `docs/`: guides, architecture, and design records. Start at the [index](docs/README.md).

## Read first

- Follow `CONTRIBUTING.md` when you edit code or prose.
- Read `.claude/skills/data-handling/SKILL.md` before you change capture, storage, model access, or actions for the user.
- Before you change a package, read its `AGENTS.md`.

## Package rules

- Import another package only by its name and its declared subpaths, such as `./testing` and `./browser`.
- The package graph is in `tooling/src/boundaries/packages.ts`. The boundary check enforces it.
- Add a dependency edge only with a design record.
- Each package guide must stay true. If a change alters the package purpose, public exports, dependencies, or a rule in the guide, update the guide in the same commit.
- After you update a guide, run `bun run guides`. Lint fails when a guide is missing or its facts block is out of date.

## Work on the requested change

Inspect the current worktree and preserve unrelated edits. Record the reasoning and sequence of the change in `docs/` before you implement it. If you extend a design, use its existing record.

Keep types and names explicit. Use Bun, the existing module boundaries, and the checks of the repository. Add a dependency only for a concrete reason.

Keep active skills delivery separate from legacy profile compatibility. Do not inject an aggregated profile into an active skill environment.

## Checks

```bash
bun install
bun run check
bun test packages/skills
bun run cli --help
bun run build
bun run stage
```

`bun run check` runs typecheck, lint, knip, and tests. Turborepo caches typecheck and test. Run focused checks while you edit and the full gate before handoff. Report failures that existed before your change separately. Tests use synthetic fixtures. An authenticated agent run or a paid evaluation needs an explicitly authorized scope.

## Data boundaries

- Keep private repository material, transcripts, receipts, and identifying paths outside this public checkout, including ignored files. Use synthetic examples that you wrote yourself.
- Public evaluation material may name models and versions. It must not name evaluators, billing details, private installations, paths, or repositories. An evaluation of public code may name its public source and evaluation repositories.
- Each capture source needs its own consent flag, off by default. Document each new source in `docs/data-handling.md`.
- Resolve eligible learning text through `resolveRedacted`. Exclude tool results, tool-returned file contents, thinking blocks, and data-access results from learning.
- Keep repository and remote-owner scope. Global guidance needs explicit global evidence or a direct user decision.
- Keep manual edits and ownership checks when you write skills or native instructions. Keep every change reversible.

## Documentation

- Write every Markdown file, and every text that a person reads, in ASD-STE100 Simplified Technical English at about 80% strictness. Use the `write-plain-english` skill. The one exception is `CHANGELOG.md`, which Release Please writes.
- Use the [documentation index](docs/README.md) to find user guides, architecture, and design history.
- Update each page that your change affects. Update the architecture diagram when the flow or a trust boundary changes.
- Write for the reader of the page. Remove session narration, expired task instructions, and duplicate explanations. Keep current instructions accurate. Label historical designs as history.
- Keep the README a short path to a working setup: a quick start with time estimates, plain results, and a privacy summary. Put usage detail in `docs/guides/`. Link to migration, architecture, and evaluation methods.
- User-facing commands use the installed `shadowclone` CLI. Bun commands belong in contributor instructions.

## Handoff and Git

Explain what changed, how you verified it, and any limit that remains. Commit, push, and open a draft pull request without stopping for a diff review. Before you push to a branch that has a pull request, run `gh pr view --json state`.

Commit messages use one lowercase conventional-commit subject, with no body and no co-author trailer. Pull request titles use the same format, such as `fix: keep cursors after a failed index`. A squash merge uses the title as the commit subject on `main`. Release Please creates releases only from conventional commits. Never force push or amend a pushed commit.

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
