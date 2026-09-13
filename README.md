# shadowclone

Shadowclone learns your engineering taste from the coding-agent sessions already on your machine. It turns repeated corrections, explicit preferences, and existing instructions into one editable profile and a portable skill library. Claude Code, Codex, Cursor, and Antigravity can use that profile in ordinary sessions. When you delegate work, each clone inherits the same guidance. The clones' sessions become new transcripts, so their work can improve the profile they all share.

The profile is more than scaffolding for a model. A stronger model may need fewer generic instructions, but it does not know that you require zero comments, complete variable names, or small files. First-party tools such as Claude Code's `/doctor` rightsize one vendor's instruction files from their text. They cannot see how you corrected agents across sessions or keep other vendors in sync. Anthropic's suggested replacement for an explicit comment rule, "match the surrounding code's comment density," would lose this repository's zero-comments preference.

## Privacy comes first

Every source has its own setting, defaults off, and appears by name before consent. The default setup asks one grouped question for detected session sources, Git remote names, and existing agent context. It asks separately about skills and background learning. `init --advanced` offers individual source choices. The paths that may be read are:

| Source | Path |
| --- | --- |
| Claude Code sessions | `~/.claude/projects/` |
| Claude prompt history | `~/.claude/history.jsonl` |
| Codex sessions | `~/.codex/sessions/` or `$CODEX_HOME/sessions/` when set |
| Cursor chats | `~/.cursor/chats/` |
| Antigravity logs | `~/.gemini/antigravity-cli/brain/` |
| Shell history | `~/.zsh_history`, `~/.bash_history` |
| Repository guidance | root `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and direct `SKILL.md` files under `.claude/skills/` and `.agents/skills/` |
| Agent context | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.codex/AGENTS.override.md`, supported personal and repository skill roots, and `~/.claude/projects/<repo>/memory/` or `~/.codex/memories/`, only for consented evaluation |
| Skill library | `~/.claude/skills/`, `~/.agents/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, `~/.gemini/config/skills/`, configured repository roots, and selected provider plugin caches |
| Git metadata | repository Git remote names |

Source detection checks whether a configured root has content. A directory check reads at most one entry to establish that fact and retains no name before consent. Agent transcripts can contain private code, credentials, internal hosts, and customer data. Shadowclone never copies raw transcripts into its store. Its SQLite index holds pointers and event kinds. Eligible excerpts pass through `resolveRedacted`, the single secret-redaction gate, before a model receives them. Tool results, file-read contents, thinking blocks, and data-access results are excluded from learning by category.

Learning and evaluation send only redacted excerpts through your own authenticated agent CLI. A remote action from `shadowclone run` needs separate approval for that run. There is no Shadowclone service, API key, account, or telemetry. The profile is Markdown under `~/.shadowclone/profile/`; you can read, edit, or delete it. `shadowclone forget --all` removes Shadowclone's local state and recorded integrations in one step. Your original transcripts remain where your agents wrote them. [Privacy design](docs/architecture/05-privacy.md).

## Start from this checkout

```bash
bun install
bun run cli init
```

The package release follows the evaluation and packaging gates. The commands below use `shadowclone`, the installed binary name; from this checkout, use `bun run cli` in its place.

`init` shows the detected agents and source paths, then asks three questions, each defaulting to yes:

1. Learn how you work from these sessions?
2. Keep your skills in sync across the detected agents?
3. Keep improving in the background as you work?

Only detected transcript sources are enabled by the first answer. Setup then imports supported repository guidance if present, synchronizes consented skills, runs a first learning pass when background learning is enabled, and installs global native guidance for detected agents. The first pass selects recent unprocessed steering and limits model calls to 12 or 90 seconds; scanning local transcripts can take longer. Reaching a model budget does not block setup. Later sessions continue bounded learning when the agent marks a useful session. No extra `learn` command is required to finish setup.

Use `shadowclone init --advanced` for individual source choices and the seed guidance wizard. Run `shadowclone wizard` later to change seed preferences and starter skills. Run `shadowclone skills configure --global` or `--repo` to configure skill roots separately. Managed policy may limit any setting.

## How it works

```text
enabled transcripts -> local index -> steering episodes -> redacted reconciliation
                                                        -> editable profile
profile + personal skills -> native agents and clones -> new transcripts
```

Plain `shadowclone learn` updates the local index and prints a structural report without model calls or profile writes. `shadowclone learn --deep` works through the oldest unprocessed episodes in bounded batches, proposes changes, and asks before applying them. `--deep --apply` accepts that local write without a prompt. Explicit reusable guidance can become active from one session; inferred behavior needs three independent sessions. The processed ledger lets later runs continue through older history. `shadowclone remember --repo "Use complete variable names."` records a direct preference immediately.

The first setup pass starts at the newest unprocessed episodes so the next session can benefit quickly. Reconciliation batches run concurrently, then apply results in their original order. Completed checkpoints let a later run reuse finished model work. All model calls use `claude`, `codex`, or `cursor-agent` under your existing authentication.

Repository imports preserve your edits and rejected rules. The compiler selects global guidance, the matching Git remote owner, and the exact repository. Without Git metadata consent, working directories stay isolated. It caps compiled guidance at 16 KiB and drops whole blocks when needed.

Native installation adds a small pointer and lifecycle hooks while preserving other instructions. Claude Code's `SessionStart` hook injects the current scoped profile into the main agent. Its `SubagentStart` hook gives spawned subagents that same profile without creating another learning request. Codex, Cursor, and Antigravity use their supported native delivery paths. A useful main-agent session can request bounded learning at session end. `shadowclone install --subagent` and `--auto-delegate` remain optional Claude repository modes.

Portable skills live in `~/.agents/skills` and sync to supported provider locations. A single edited copy becomes the source for the next sync; divergent edits are reported as conflicts. Existing user skills and plugin packages are preserved. Skill assessment reads only enabled roots, sends redacted `SKILL.md` content through the chosen agent CLI, and leaves technical or routing changes for review. [Skill maintenance](docs/skill-maintenance.md).

## Check the result

`shadowclone doctor` reports installation and engine status. `shadowclone context` prints the compiled profile for the current scope. `shadowclone history` shows local revisions, and `shadowclone undo <revision-id>` restores one when no later edit conflicts.

Transfer evaluation compares a repository-native baseline with a clone using the frozen personal environment on fresh tasks from committed HEAD. It uses isolated snapshots, checks the code change and Git integrity, and grades both arms with three blinded votes. The command reports task success, preference adherence, lift, and regressions. A one-task run is a smoke test; the standard decision run uses three tasks and two repetitions. No transfer result is claimed here before the evaluation gate runs. [Evaluation design](docs/architecture/09-evaluation.md).

```bash
shadowclone eval --repo /path/to/repository --engine codex --model gpt-5.6-luna --reasoning-effort medium --tasks 3 --repeat 2
```

`shadowclone run "fix the flaky test"` runs a headless clone in a local worktree and records a receipt. The invocation approves one worktree, branch, and local commit. Remote actions also need a matching repository policy ceiling and `--approve` for that run. No action approval carries to the next run. [Acting policy](docs/architecture/04-acting.md).

## Commands

| Command | Use |
| --- | --- |
| `shadowclone init [--advanced]` | Set consent and install detected integrations |
| `shadowclone import`, `shadowclone wizard` | Refresh repository guidance or seed choices |
| `shadowclone learn [--deep] [--dry-run] [--apply]` | Inspect history or reconcile guidance |
| `shadowclone skills`, `shadowclone skills update` | List starter guidance or maintain consented skills |
| `shadowclone skills pending`, `show`, `apply`, `reject` | Review skill proposals |
| `shadowclone learning enable|disable|status` | Control session learning |
| `shadowclone doctor`, `shadowclone context`, `shadowclone sync` | Inspect or refresh delivery |
| `shadowclone install [--agent <agent>|all] [--global|--repo]` | Install native guidance manually |
| `shadowclone uninstall [--global]` | Remove owned integrations |
| `shadowclone remember`, `history`, `undo` | Manage direct rules and revisions |
| `shadowclone eval`, `shadowclone run <task>` | Measure transfer or run a local clone |
| `shadowclone forget --all` | Remove all recorded Shadowclone state |

Contributors can run `bun install` and `bun run check`. See [the architecture](docs/architecture/README.md), [design records](docs/design/README.md), [contribution guide](CONTRIBUTING.md), and [security policy](SECURITY.md). Shadowclone is MIT licensed.
