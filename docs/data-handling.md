# Data handling

Shadowclone reads sources you enable and maintains local coding-agent guidance. It has no hosted collection service, analytics, crash reporting, or automatic upload of your environment. Model work uses your installed, authenticated agent CLI and is subject to that provider’s account and retention terms.

## Consent

Source settings live in `~/.shadowclone/config.toml` and default to off. Default setup names detected paths before asking about session access, skill maintenance, and background learning. `init --advanced` offers individual source choices. Managed policy can restrict these settings.

Before consent, setup may check whether a configured source root exists and contains data. It reduces that check to a temporary boolean, without opening source contents or retaining entry names. Reading source contents requires the corresponding setting.

Source access does not by itself authorize automatic skill edits. Disabling a source stops future use of its evidence; it does not erase existing learning or requests retained by a provider.

## Sources

| Setting | What may be read |
| --- | --- |
| `claude-code` | Session JSONL under `~/.claude/projects/` |
| `claude-prompts` | `~/.claude/history.jsonl` |
| `codex` | Sessions under `~/.codex/sessions/`, or `$CODEX_HOME/sessions/` |
| `cursor` | Chat databases and metadata under `~/.cursor/chats/` |
| `antigravity` | Generated conversation logs under `~/.gemini/antigravity-cli/brain/` |
| `antigravity-workspaces` | `~/.gemini/antigravity-cli/history.jsonl` for workspace attribution |
| `shell` | `~/.zsh_history` and `~/.bash_history` |
| `declared-rules` | Repository-root `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and direct `SKILL.md` files under `.claude/skills/` and `.agents/skills/` |
| `claude-rules` | Markdown rules under the current repository’s `.claude/rules/` for compatible native guidance |
| `claude-memory` | Claude memory under `~/.claude/projects/<repo>/memory/`; recurring extraction requires registered repositories with verified identity |
| `agent-context` | Selected-agent personal instructions and skills, kept as an original baseline and copied into evaluation arms |
| `skill-library` | Consented personal, repository, custom, and third-party skill roots |
| `git-metadata` | Local repository remote names used to determine scope |
| `repository-manifests` | Scripts and dependency names in `package.json`, lockfile names, `pyproject.toml`, `requirements.txt`, `Makefile` targets, CI workflow files, and top-level entry names for repository setup |

Personal skill locations include `~/.agents/skills/`, `~/.claude/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, and `~/.gemini/config/skills/`. Configured provider plugin caches may also be reviewed. Codex paths follow `$CODEX_HOME` when set.
Evaluation context can include `~/.claude/CLAUDE.md`, Codex `AGENTS.md` and `AGENTS.override.md`, and the selected skill catalog. Each study freezes its selected inputs. See [evaluation](architecture/09-evaluation.md) for the protocol.

The preference study keeps suites, keys, agent homes, and receipts in a private directory outside every checkout. Each candidate receives separate workspace and agent-home copies. Native filesystem policies deny credential reads and network access. Authentication is copied temporarily for the selected CLI and removed in cleanup. Candidates may write Git history inside their disposable workspace and its local remote, and an offline `gh` stub records pull request requests. Learning reads only consented sources through the normal redacted path.

Transcript parsers can encounter prompts, assistant responses, tool results, and thinking blocks while reading an enabled file. Tool-result payloads, tool-returned file contents, thinking, and data-access results are excluded from learning. Eligible prompts and responses can still contain sensitive information.

## What reaches a model

| Operation | Provider access |
| --- | --- |
| Plain `learn` after setup | Local indexing and reporting; no model calls |
| Deep or background learning | Selected redacted steering, supporting context, and guidance needed for reconciliation |
| Skill maintenance | Redacted catalogs and full instructions for overlapping workflows, plus evidence for proposed updates; supporting resources are checked locally |
| Browser editor | Opening the editor makes no model request; optional build descriptions and skill drafts require review of their redacted payload, provider, and limits |
| `run` | The authorized task worktree and guidance |
| Evaluation | Synthetic task workspaces and the tested setup's skills and instructions; judges receive generated code without redaction |

First-time interactive `learn` can offer setup, which may make an authorized first learning pass. A deep dry run still calls a model.

Eligible source text crosses the shared redaction boundary before learning or context import. Redaction detects known token, host, path, and entropy patterns. It can miss confidential prose, personal information, and unusual secrets, and can remove harmless text. It is not an anonymity guarantee.

Use only material you are authorized to send to the chosen provider. Provider quota or charges still apply. Local deletion does not delete provider copies.

## Local files

| Location | Contents |
| --- | --- |
| `~/.shadowclone/config.toml` | Source consent and model/action settings |
| `~/.shadowclone/environment.json` | Learned guidance, scope, evidence, publication decisions, and builds |
| `~/.shadowclone/index.db` and sidecars | Event metadata, source references, cursors, and origin bindings |
| `~/.shadowclone/profile/` | Legacy profile state and recovery artifacts |
| `~/.shadowclone/distill/` | Derived learning checkpoints and fingerprints |
| `~/.shadowclone/skills.json` | Configured roots, maintenance ownership, and cached library review fingerprints |
| `~/.shadowclone/skill-proposals/` | Proposed edits and conflicts with redacted supporting passages and required decisions |
| Other files under `~/.shadowclone/` | Revisions, installation ownership, original-library snapshots, and learning/skill ledgers |
| `~/.shadowclone/runs/` and `worktrees/` | Task receipts, guidance, worktrees, and potentially unfinished changes |
| Agent skill and instruction directories | Published skills, resources, native routing, and hooks |
| Repository harness files | Reviewed shared instructions, skills, and checks intended for version control |

Shadowclone does not copy whole transcripts into its store. The index holds references and event metadata. Learning records, checkpoints, and original-library snapshots can still contain sensitive derived or selected content.

Generated state uses private directories and owner-only permissions where supported. Shadowclone does not encrypt it. Processes with equivalent access, administrators, and backups may still read it. Interrupted evaluation can leave temporary workspaces in its private study directory for manual cleanup.

## Scope and editing

Repository learning stays with the registered repository. Setup and deep learning register the working repository only when Git-metadata consent and skill maintenance are enabled and its remote identity verifies; blocked and unknown origins stay unregistered. Organization learning uses a normalized remote-owner identity, which is a technical scope and does not verify a legal employer boundary. Explicit global guidance applies across repositories. Guidance that names a repository, codebase, or repository path never receives global scope, even when the learning model assesses its evidence as global. Without Git-metadata consent, working directories remain isolated.

Automatic skill maintenance requires separate write authorization. Conflicting edits stay pending. Native memory and third-party packages remain unchanged. Revisions record files together and refuse an undo that would overwrite later edits.

Shared repository output is visible to anyone with repository access once committed. Setup asks separately before including personal guidance. The browser editor also offers private repository builds. Review shared output before committing it.

## Execution

`shadowclone run` authorizes one local task worktree, branch, and commit. Remote actions additionally require a repository policy ceiling and a matching grant for that run. A push sends Git objects, including repository code, without redacting them. Live agent sessions retain their host agent’s permission model.

Evaluation confines candidate writes to disposable workspaces. Verification runs separately without provider credentials or network access and does not send verifier stdout to judges. These controls depend on the supported provider and operating-system sandbox. [Execution](architecture/04-acting.md) and [evaluation](architecture/09-evaluation.md) describe their contracts.

The browser editor listens on loopback, serves local assets, checks request origins, and uses an ephemeral token. Opening it does not grant new capture consent.

Use AI in the skill editor sends only the typed form fields. It reads no repository files. Model requests use the learning execution contract with no tools, one call, and a 60-second deadline. Providers with dollar-cap support receive a $0.25 limit; other providers show that no dollar cap can be enforced. Cancellation aborts the request, but usage already incurred may still be charged. Reviews and cached results remain in server memory until the editor closes. Generated skill drafts remain editable and require the usual build review before publication.

## Retention and removal

There is no automatic expiry policy. Use `learning disable` to stop background learning and source settings to stop future reads. Use `skills automatic off` to stop automatic skill edits. Review active guidance with `context --explain` and reverse a revision with `undo`.

`uninstall --global` removes recorded global integrations; `uninstall --local` removes recorded integrations in the current repository. Ownership checks preserve unrelated content and refuse conflicting managed edits. Legacy artifacts without ownership records may need manual removal.

`shadowclone forget --all` restores or removes recorded managed files and deletes Shadowclone’s local state, including task worktrees and original snapshots. Preserve unfinished work first. A conflicting maintained file can stop the operation before it completes.

Original transcripts, native memory, provider-retained requests, external repositories, backups, remote branches, PRs, and Git history remain. Repository harness files remain too; use `undo` before deleting revision history, or remove them through version control. There are no source-specific or repository-specific forget flags.

## Managed installations and reports

Root-owned managed policy can disable Shadowclone or restrict sources, engines, origins, and action tiers. It governs this installation, not other programs under the same account. `local-only` blocks hosted learning; a local model engine is not implemented.

Report exposures privately through [security reporting](../SECURITY.md). Public reports should contain synthetic examples and reviewed summaries, never raw transcripts, private receipts, credentials, or identifying paths.
