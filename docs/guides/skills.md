# Skill maintenance

Skills are ordinary files you can inspect and edit. Shadowclone reviews the consented library, updates a relevant workflow, or creates a skill when one is missing. It preserves supporting files, unrelated instructions, and invocation settings.

```bash
shadowclone skills list
shadowclone skills update
shadowclone skills pending
```

Reading a library and allowing automatic edits are separate choices. Supported changes to authorized user skills can apply automatically. Third-party packages stay unchanged and receive local companion skills. Conflicts and uncertain changes remain pending for review.

With maintenance enabled, an update reviews the selected agent's applicable skill library, including installed third-party skills, even when no new learning is waiting.

## Review pending work

`skills pending` distinguishes candidate evidence, missing repository scope, conflicting evidence, and publication backlog. Each decision belongs to its own rule and scope. Organization guidance waits for a matching registered repository and is never promoted to global guidance to finish publication.

With Git-metadata consent and skill maintenance enabled, setup and `learn --deep` register the repository where they run. Blocked or unknown origins stay unregistered.

A conflict proposal contains the supporting passages and the decision needed. Inspect it with `shadowclone skills show <proposal-id>`. Resolve the owning instructions and run an update again, or dismiss an unsupported finding with `shadowclone skills reject <proposal-id>`.

Conflict proposals cannot apply edits or choose precedence. Stale status alone does not authorize removing an instruction.

## Skill locations and synchronization

Personal skills use `~/.agents/skills` as their canonical directory. Claude and Antigravity receive copies; Codex, Cursor, and Pi discover that directory. Cursor also reads `~/.claude/skills`, so it sees the Claude copies as well. Repository skills live under `.agents/skills` and `.claude/skills`.

Native routing lists each equipped skill as `- <moment>: <skill>`, using its `shadowclone-applies-when` metadata. The host reads the full description from its own skill list. Skills without that metadata, such as your own skills, share one line: `- when the task matches the skill's own description: <skill>, <skill>`.

`shadowclone sync` propagates a changed maintained copy, refreshes native routing from its validated description, and preserves conflicting edits for review. For skills equipped from Shadowclone's bundled library, `sync` replaces a copy only when its text matches a version that Shadowclone shipped, and prints one line per updated skill. A copy with any other text stays as it is, including an edit that the wizard copied to every location when you applied a build. `sync` names each such path so you can review it in `shadowclone wizard`. A skill you changed in the build editor is never replaced. Only `shadowclone sync` updates bundled skills. Background learning, `learn`, and `init` leave them unchanged, so run `shadowclone sync` after you upgrade Shadowclone. If routing exceeds 4 KiB, `sync` reports the overflow and leaves existing native instructions intact. If an agent's instruction file links to a regular file in your home folder, such as `~/.codex/AGENTS.md` pointing to `~/.agents/AGENTS.md`, `sync` updates the routing in that file and keeps the link. If an instruction file links anywhere else, `sync` updates every other agent, names the link, and exits with status 1. That agent keeps its old routing until you replace the link with a regular file.

When a release retires a bundled skill, `sync` replaces it with its successor in each build that selected it, and prints one line per build. A retired skill whose copy you edited, or that you changed in the build editor, stays selected, and `sync` names it so you can replace it in `shadowclone wizard`. If the successor cannot be installed, `sync` names the build and the reason, changes nothing in that build, and exits with status 1.

When Shadowclone removes the last file of a skill, it also removes the empty skill folder. Folders that still hold your own files stay.

## History and undo

Every publication has a revision covering its skills, resources, native instructions, and learning decisions:

```bash
shadowclone history
shadowclone history <revision>
shadowclone undo <revision>
```

Undo refuses to overwrite later edits. Existing profile-based installations first need [skills migration](../migration.md).

## Controls

| Command | What it does |
| --- | --- |
| `shadowclone skills configure --global` / `--repo` | Configure personal or repository skill roots |
| `shadowclone skills automatic on` / `off` | Allow or stop automatic edits without deleting published files |
| `shadowclone skills disable` | Stop library access |
| `shadowclone skills retry <learning-key>` | Queue a record again after resolving its conflict |
| `shadowclone skills exclude <learning-key> "This was a temporary exception."` | Record why guidance should stay unpublished |

Configuration accepts `--root <directory>` for a custom root and `--third-party` for a package you do not own. Model-assisted updates also require deep-learning consent. After retrying a record, run `shadowclone skills update`.

Updates share the learning call and time limits. Completed catalog batches and document comparisons are cached. A nonzero `libraryDeferred` count means review remains, including invalid documents that need repair. Run another update to continue.
