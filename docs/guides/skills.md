# Skill maintenance

Skills are ordinary files that you can inspect and edit. During maintenance, shadowclone reviews the consented library, updates a relevant workflow, or creates a skill when none exists. It keeps supporting files, unrelated instructions, and invocation settings. Run `shadowclone skills list`, `update`, or `pending`.

Reading a library and allowing automatic edits are separate choices. Supported changes to authorized skills apply automatically. Conflicts and uncertain changes stay pending. Third-party packages stay unchanged and get local companions. Library review compares a third-party skill only with your own skills, so it never proposes a conflict between two third-party skills. With maintenance on, an update reviews the library of the selected agent, even without new learning.

## Install skills without shadowclone

Use the skills CLI to choose portable skills manually:

```bash
npx skills add theonly1me/shadowclone
npx skills add theonly1me/shadowclone --skill guided-pr-review shadowclone-review
```

Use `--list` to inspect the available skills first.
This installation does not enable shadowclone learning or install its CLI.
The guided review skill works with a local coding agent and the full repository.
Install its `shadowclone-review` companion to investigate locally before building the guide.
The `@shadowclone/skills` npm package contains the same portable skills and supporting files.

The separate `@shadowclone/skills` npm artifact contains the same root skills and their supporting files.
The skills CLI accepts a repository, a local directory, or a direct tarball URL.
Use the repository command above for selection, or extract the npm artifact and pass its directory.
The shadowclone CLI continues to bundle and equip the same content.

## Review pending work

`skills pending` separates candidate evidence, missing repository scope, conflicting evidence, and publication backlog. Organization guidance waits for a matching registered repository and never becomes global guidance to finish publication. Setup and `learn --deep` register the repository where they run if you gave Git-metadata consent and turned on skill maintenance. To keep a repository's rules out of its files, run `shadowclone learning repositories set . --private` there first. Background [triage](learning.md#triage-after-each-session) discards duplicates and applies the rest when automatic maintenance is on. `learning reject <key>` removes a rule from this list for good.

When proposals wait for your decision, the next agent session says so once. The agent then shows each proposal and asks you with its multiple-choice question tool: apply, reword, reject, or decide later. The `shadowclone-context` skill holds these steps. The agent asks again only after the set of waiting proposals changes.

A conflict proposal holds the supporting passages and the decision it needs. It cannot apply edits or choose precedence. Inspect it with `shadowclone skills show <proposal-id>`, resolve the owning instructions, and update again. To dismiss an unsupported finding, run `shadowclone skills reject <proposal-id>`. A stale status alone does not authorize removal of an instruction.

## Skill locations and routing

Personal skills live in `~/.agents/skills`. Claude and Antigravity get copies. Codex, Cursor, Pi, and OpenCode read that folder, and Cursor and OpenCode also read `~/.claude/skills`. Repository skills live under `.agents/skills` and `.claude/skills`.

Native routing lists each equipped skill as `- <moment>: <skill>`, with the moment from the `shadowclone-applies-when` metadata of the skill. Skills with no such metadata share one line: `- when the task matches the skill's own description: <skill>, <skill>`.

## Sync

`shadowclone sync` copies a changed maintained skill to its other locations, refreshes native routing, and keeps conflicting edits for your review. Only `sync` updates bundled skills, so run it after you upgrade.

For bundled skills that you equipped, `sync` replaces a copy only if its text matches a version that shadowclone shipped. It keeps and names any other copy, so you can review it in `shadowclone wizard`. It never replaces a skill that you changed in the build editor. If routing grows past the 4 KiB native limit, `sync` reports the overflow and keeps the existing instructions.

If an agent's instruction file links to a regular file in your home folder, `sync` updates that file and keeps the link. For example, `~/.codex/AGENTS.md` can point to `~/.agents/AGENTS.md`. If the file links anywhere else, `sync` updates every other agent, names the link, and exits with status 1. That agent keeps its old routing until you replace the link with a regular file.

When a release retires a bundled skill, `sync` replaces it with its successor in each build that selected it. If you edited the retired skill, it stays selected and `sync` names it. If `sync` cannot install the successor, it names the build and the reason, changes nothing in that build, and exits with status 1.

## History and undo

Each publication has a revision. Run `shadowclone history`, `shadowclone history <revision>`, or `shadowclone undo <revision>`. Undo refuses to overwrite later edits.

## Controls

- `shadowclone skills configure --global` or `--repo` chooses the skill roots to maintain. `--root <directory>` adds a custom root, and `--third-party` adds a package that you do not own.
- `shadowclone skills automatic on` or `off` allows or stops automatic edits and keeps the published files.
- `shadowclone skills disable` stops access to the skill library.
- `shadowclone skills retry <learning-key>` queues a record again after you resolve its conflict. Then run `shadowclone skills update`.
- `shadowclone skills exclude <learning-key> "This was a temporary exception."` records why guidance stays unpublished.

Updates with a model need deep-learning consent and share the call and time limits of learning. A `libraryDeferred` count above zero means that review remains, including invalid documents to repair. Run another update.
