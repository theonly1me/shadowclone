# Skill maintenance

Skills are ordinary files that you can inspect and edit. Shadowclone reviews the consented library, updates a relevant workflow, or creates a skill when none exists. It keeps supporting files, unrelated instructions, and invocation settings.

```bash
shadowclone skills list
shadowclone skills update
shadowclone skills pending
```

Reading a library and allowing automatic edits are separate choices. Supported changes to the skills that you authorize can apply automatically. Third-party packages stay unchanged and get local companion skills. Conflicts and uncertain changes stay pending for your review.

With maintenance on, an update reviews the skill library of the selected agent, including installed third-party skills. It does this even when no new learning waits.

## Review pending work

`skills pending` separates candidate evidence, missing repository scope, conflicting evidence, and publication backlog. Each decision belongs to its own rule and scope. Organization guidance waits for a matching registered repository. Shadowclone never promotes it to global guidance to finish publication.

If you gave Git-metadata consent and turned on skill maintenance, setup and `learn --deep` register the repository where they run. Blocked or unknown origins stay unregistered.

A conflict proposal holds the supporting passages and the decision that it needs. Inspect it with `shadowclone skills show <proposal-id>`. Resolve the owning instructions and run an update again.

To dismiss an unsupported finding, run `shadowclone skills reject <proposal-id>`. A conflict proposal cannot apply edits or choose precedence. A stale status alone does not authorize the removal of an instruction.

## Skill locations and routing

Personal skills use `~/.agents/skills` as their main folder. Claude and Antigravity get copies. Codex, Cursor, and Pi read that folder. Cursor also reads `~/.claude/skills`, so it sees the Claude copies too. Repository skills live under `.agents/skills` and `.claude/skills`.

The session hook supplies the repository guidance that the global native file cannot hold. It does not repeat global guidance.

Native routing lists each equipped skill as `- <moment>: <skill>`. The moment comes from the `shadowclone-applies-when` metadata of the skill. The agent reads the full description from its own skill list. Skills with no such metadata, such as your own skills, share one line: `- when the task matches the skill's own description: <skill>, <skill>`.

## Sync

`shadowclone sync` does these steps:

- It copies a changed maintained skill to its other locations.
- It refreshes native routing from the validated description of each skill.
- It keeps conflicting edits for your review.

For skills that you equipped from the bundled library, `sync` replaces a copy only if its text matches a version that Shadowclone shipped. It prints one line for each updated skill. A copy with any other text stays as it is.

This includes an edit that the wizard copied to every location when you applied a build. `sync` names each such path so that you can review it in `shadowclone wizard`. A skill that you changed in the build editor is never replaced.

Only `shadowclone sync` updates bundled skills. Background learning, `learn`, and `init` leave them unchanged, so run `shadowclone sync` after you upgrade Shadowclone. `sync` also adds the always-on `write-plain-english` skill to existing builds.

Native instruction sections have a limit of 4 KiB. Detailed workflows load only when the agent selects them. If routing grows past 4 KiB, `sync` reports the overflow and keeps the existing native instructions. It never cuts a rule in silence.

If an agent's instruction file links to a regular file in your home folder, `sync` updates the routing in that file and keeps the link.

An example is `~/.codex/AGENTS.md` that points to `~/.agents/AGENTS.md`. If an instruction file links anywhere else, `sync` updates every other agent, names the link, and exits with status 1. That agent keeps its old routing until you replace the link with a regular file.

When a release retires a bundled skill, `sync` replaces it with its successor in each build that selected it. It prints one line for each build.

If you edited the retired skill, or changed it in the build editor, the skill stays selected. `sync` names it so that you can replace it in `shadowclone wizard`. If `sync` cannot install the successor, it names the build and the reason, changes nothing in that build, and exits with status 1.

When Shadowclone removes the last file of a skill, it also removes the empty skill folder. Folders that still hold your own files stay.

## History and undo

Each publication has a revision. A revision covers its skills, resources, native instructions, and learning decisions.

```bash
shadowclone history
shadowclone history <revision>
shadowclone undo <revision>
```

Undo refuses to overwrite later edits. An installation that uses a profile needs [migration](migration.md) first.

## Controls

| Command                                                                       | What it does                                                |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `shadowclone skills configure --global` or `--repo`                           | Choose the personal or repository skill roots to maintain   |
| `shadowclone skills automatic on` or `off`                                    | Allow or stop automatic edits, and keep the published files |
| `shadowclone skills disable`                                                  | Stop access to the skill library                            |
| `shadowclone skills retry <learning-key>`                                     | Queue a record again after you resolve its conflict         |
| `shadowclone skills exclude <learning-key> "This was a temporary exception."` | Record why guidance stays unpublished                       |

`skills configure` accepts `--root <directory>` for a custom root and `--third-party` for a package that you do not own. Updates with a model also need deep-learning consent. After you retry a record, run `shadowclone skills update`.

Updates share the call limits and time limits of learning. Shadowclone caches completed catalog batches and document comparisons. A `libraryDeferred` count above zero means that review remains, including invalid documents that need repair. Run another update to continue.
