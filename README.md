# shadowclone

Shadowclone learns from the coding sessions and memory sources you permit, then maintains the skills your agents already use. It updates a matching workflow, creates a missing skill, and writes small routing sections in native instructions for Claude Code, Codex, Cursor, and Antigravity.

A mandatory baseline skill carries universal guidance. Task skills retain detailed procedures, preferences, prerequisites, and examples. Internal records preserve evidence and history; agents receive skills and native routing instead of a separate compiled profile. Learning adds context to an existing model and does not guarantee adherence. [Why I built it](docs/motivation.md).

## Privacy comes first

Every source has its own setting, defaults off, and appears by name before consent. The default setup asks one grouped question for detected session sources, Git remote names, and existing agent context. It asks separately about skills and background learning. `init --advanced` offers individual source choices. The paths that may be read are:

| Source | Path |
| --- | --- |
| Claude Code sessions | `~/.claude/projects/` |
| Claude prompt history | `~/.claude/history.jsonl` |
| Codex sessions | `~/.codex/sessions/` or `$CODEX_HOME/sessions/` when set |
| Cursor chats | `~/.cursor/chats/` |
| Antigravity logs | `~/.gemini/antigravity-cli/brain/` |
| Antigravity workspace attribution | `~/.gemini/antigravity-cli/history.jsonl` |
| Claude memory extraction | `~/.claude/projects/<repo>/memory/` for explicitly registered repositories; read-only and enabled separately |
| Shell history | `~/.zsh_history`, `~/.bash_history` |
| Repository guidance | root `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and direct `SKILL.md` files under `.claude/skills/` and `.agents/skills/` |
| Agent context | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.codex/AGENTS.override.md`, supported personal and repository skill roots, and `~/.claude/projects/<repo>/memory/` or `~/.codex/memories/`, only for consented evaluation |
| Skill library | `~/.claude/skills/`, `~/.agents/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, `~/.gemini/config/skills/`, configured repository roots, and selected provider plugin caches |
| Git metadata | repository Git remote names |
| Repository manifests | in the repository where `shadowclone init --repo` runs: `package.json` scripts and dependency names, lockfile names, `pyproject.toml`, `requirements.txt`, `Makefile` targets, `.github/workflows/*.yml`, and top-level entry names |

Source detection checks whether a configured root has content. A directory check reads at most one entry to establish that fact and retains no name before consent. Agent transcripts can contain private code, credentials, internal hosts, and customer data. Shadowclone never copies raw transcripts into its store. Its SQLite index holds pointers and event kinds. Eligible excerpts pass through `resolveRedacted`, the single secret-redaction gate, before a model receives them. Tool results, file-read contents, thinking blocks, and data-access results are excluded from learning by category.

Learning sends eligible redacted excerpts through your own authenticated agent CLI. Evaluation also gives that CLI access to a disposable repository snapshot and sends generated code to judges without redaction. Use only repositories you are authorized to send to that provider. A remote action from `shadowclone run` needs separate approval for that run. There is no Shadowclone service, API key, account, or telemetry. Readable learning records live in `~/.shadowclone/environment.json`; original libraries and revisions remain local. Skills are ordinary editable files. Legacy profiles remain as recovery artifacts after migration. `shadowclone forget --all` removes Shadowclone's local state and recorded integrations, preserving unrelated content and stopping on conflicting edits. Harness files written into a repository stay there; remove them with `shadowclone undo` or your version control. Your original transcripts remain where your agents wrote them. [Privacy design](docs/architecture/05-privacy.md).

## Install

```bash
npm install -g @shadowclone/cli
shadowclone init
```

The commands below use the installed `shadowclone` binary. From this checkout, use `bun run cli` in its place.

`init` shows the detected agents and source paths, then asks three questions, each defaulting to yes:

1. Learn how you work from these sessions?
2. Keep your skills in sync and automatically maintain them across the detected agents?
3. Keep improving in the background as you work?

Only detected transcript sources are enabled by the first answer. Setup then imports supported repository guidance if present, synchronizes consented skills, runs a first learning pass when background learning is enabled, and installs global native guidance for detected agents. The first pass selects recent unprocessed steering and limits model calls to 12 or 90 seconds; scanning local transcripts can take longer. Reaching a model budget does not block setup. Later sessions continue bounded learning when the agent marks a useful session. No extra `learn` command is required to finish setup.

Use `shadowclone init --advanced` for individual source choices and the seed guidance wizard. Run `shadowclone wizard` later to change seed preferences and starter skills. Run `shadowclone skills configure --global` or `--repo` to configure skill roots separately. Managed policy may limit any setting.

## How it works

```text
enabled sessions and memory -> redacted learning -> internal evidence records
                                                  -> maintain or create skills
skills + small native routing -> coding agents -> new feedback
```

`shadowclone init --repo` sets up the current repository with files meant to be committed: a managed section in `AGENTS.md` with read-first skills, the detected gate and commands, and your applicable rules; an `@AGENTS.md` import in `CLAUDE.md`; an authored `feature-workflow` skill with approval boundaries; and `.shadowclone/harness.json` with the gate, derived conventions, and fingerprints. If this machine is not set up yet, it runs the personal setup first. It previews every file and writes only after you confirm. Personal global rules are included only when you confirm for that repository, and a rule that names only tools or paths the repository lacks is left out. `--skill <name>` copies a personal skill into `.agents/skills/` and `.claude/skills/`. Text outside the managed sections stays yours, an edited section is never overwritten, and `shadowclone undo <revision>` restores the previous files. The harness files are meant to be committed, so anyone with repository access sees them.

`shadowclone check` verifies these files and enforces its derived conventions (file length, forbidden characters such as em-dashes, lint or type suppressions, and TypeScript comments) with a fix for each finding. `--changed` limits it to uncommitted files, so older code does not block new work. `init --repo` also adds a Claude Code Stop hook to your personal `.claude/settings.local.json` (skip it with `--no-enforce`) that runs the check and sends the findings back to Claude before it finishes; it blocks once per stop so an unfixable finding never loops. Other agents are held to the same conventions through the `AGENTS.md` finish line and your CI.

`shadowclone sync` refreshes native routing and synchronizes maintained copies, preserving divergent edits. On migrated installations, memory extraction runs during learning for registered repositories when the `claude-memory` source is enabled. Native Claude memory is never changed.

Plain `shadowclone learn` updates the local index and prints a structural report without model calls or profile writes. `shadowclone learn --deep` starts with the newest unprocessed episodes in bounded batches, proposes changes, and asks before applying them. `--deep --apply` accepts that local write without a prompt. Explicit reusable guidance can become active from one session; inferred behavior needs three independent sessions. The processed ledger lets later runs continue backward through older history. `shadowclone remember --repo "Use complete variable names."` records a direct preference immediately.

The first setup pass starts at the newest unprocessed episodes so the next session can benefit quickly. Reconciliation batches run concurrently, then apply results in their original order. Completed checkpoints let a later run reuse finished model work. All model calls use `claude`, `codex`, or `cursor-agent` under your existing authentication.

Repository imports remain auditable evidence and are excluded from behavioral publication because agents already load their repository instructions. Learning stays within its recorded global, organization, or project scope. A repository must be explicitly registered and retain its verified Git identity before scoped publication.

Native `CLAUDE.md` and `AGENTS.md` sections require the baseline and explain when to read maintained skills. Hooks, MCP, optional subagents, and dispatch use the same routing. The baseline and native sections each have a 4 KiB limit. Evidence is retained when publication needs review or exceeds a budget. Detailed skill bodies load when selected.

Portable skills use canonical `~/.agents/skills` with copies for Claude and Antigravity. Codex and Cursor discover the canonical directory. Supported updates to user-owned skills require separate automatic-maintenance authorization. Exact section edits preserve unrelated text, invocation settings, and supporting files. Third-party packages receive local companions. Conflicts and uncertain technical changes stay pending. [Skill maintenance](docs/skill-maintenance.md).

## Migrate and inspect

Existing installations keep their prior delivery until an explicit migration activates skills:

```bash
shadowclone migrate skills --repo /path/to/repository
shadowclone migrate skills --apply --automatic --memory --repo /path/to/repository
shadowclone skills pending
shadowclone migrate skills --apply --activate-only
shadowclone context --explain
```

The first command is read-only. Apply freezes the original skill library and native instructions, retains learning and references internally, and publishes supported changes in reversible batches. Repeat apply to resume within the existing learning call, time, and supported cost limits. `--automatic` authorizes supported skill edits; `--memory` enables recurring read-only extraction. Omit either option to retain its current setting. Activation requires coverage for applicable learning and verified published files. Learning for unregistered repositories remains stored and visible.

`shadowclone skills automatic on|off` controls write authorization independently of reading sources. `skills pending` explains unpublished learning. `skills retry <key>` queues it after a conflict is resolved; `skills exclude <key> <reason>` records an explicit decision. `history` and `undo <revision>` inspect and restore grouped skill, resource, routing, and evidence changes when later edits do not conflict. Legacy profile repair and one-time memory migration remain available before skills migration.

The `guidance-skills-v1` evaluation protocol freezes four conditions: Bare, original Skills, original Skills + Memory, and maintained Skills + native routing. Original and maintained libraries are separate snapshots. The maintained arm receives no profile overlay. It supports Claude and Codex at medium effort; historical suites retain their original meanings. Paid evaluation is separate from migration and requires explicit run limits. No improvement is claimed from successful publication alone.

The historical transfer evaluator compares three matched setups: repository guidance only, that guidance plus the existing personal skill/context library, and both plus the Shadowclone profile. It freezes a source-backed coding-preference rubric before execution and saves three blinded votes per check. Correctness is graded separately. Missing grades are reported as ungraded, and a completed evaluation does not require Clone to win. [Evaluation design](docs/architecture/09-evaluation.md).

The opt-in `--protocol guidance-v2` compares Bare, Skills, Skills plus current Claude memory, and Skills plus the current Shadowclone startup index. It freezes the live memory and startup profile, checks successful skill and reference reads, and reports preference and memory knowledge separately. Code cases run focused changed tests in a restricted sandbox; failures and unverifiable runs remain explicit. A pilot runs two cases once with a ceiling of $5; it does not establish improvement by itself. The historical `guidance-v1` protocol remains available for older receipts. [Guidance protocol](docs/architecture/09-evaluation.md#guidance-and-memory-protocol).

Guidance evaluation validates the installed Claude CLI's judge schema against a loopback-only mock before paid execution; this preflight currently requires macOS. The documented `--recover-preflight-failure` option can recover a verified local schema rejection without losing saved evidence or resetting cost and invocation limits. Other missing-cost failures remain blocked.

The opt-in `--validation-of <completed-pilot-id> --cumulative-budget-usd 10` repeats the same two frozen pilot cases twice across all four conditions. It subtracts the original pilot's spend, permits at most 48 additional invocations and 45 minutes, and always resumes the same linked validation. It also opts into four judge-only repository sources at the frozen commit, named in the private scenario. This packet is redacted, hashed, line-numbered, and limited to 64 KiB. It is never added to candidate context. Measurement version 2 records canonical successful reads and explicit unknown edit timing; historical trace measurements remain labelled unreliable. Validation does not require Shadowclone to win or authorize a larger evaluation.

`--maintenance-of <completed-validation-id> --suite-id <maintained-suite-id> --additional-budget-usd 10` explicitly authorizes one linked maintenance comparison with at most 48 additional invocations and 45 minutes. It requires a prepared, revision-backed correction to one managed reference and preserves the historical Claude memory baseline. Source-grounded judging includes the two complete frozen historical memory sources and four exact repository path-existence checks in the same 64 KiB judge-only packet. These sources are selected by this explicit protocol, not captured by default. The comparison reports Bare, Skills, Skills + Claude memory, and Skills + Shadowclone. Repeating the command resumes the same allowance and deadline; it does not authorize automatic memory repair or prove equal-fact superiority.

`--comparison-of <completed-maintenance-id> --additional-budget-usd 20 --max-calls 96 --deadline-seconds 5400` selects all four frozen cases twice for a separately approved comparison. It reuses the parent's suite and source packet, uses judge version 4, and records the full historical spending baseline. Repeating it resumes the same child receipt without renewing its allowance or deadline. Unknown costs, changed inputs or limits, model mismatch, and isolation failures stop execution. The model remains exact Sonnet 5 at medium effort; the usual protocol, repository, model, effort, and `--yes` arguments are required.

```bash
shadowclone eval --repo /path/to/repository --engine codex --model gpt-5.6-sol --reasoning-effort medium --tasks 3 --repeat 2
```

`shadowclone run "fix the flaky test"` runs a headless clone in a local worktree and records a receipt. The invocation approves one worktree, branch, and local commit. When the repository has a harness, its gate and `shadowclone check --changed` run in a no-network sandbox before the commit; a failure gets one repair attempt, and a change that still fails stays uncommitted with `gate: failed` in the receipt. Remote actions also need a matching repository policy ceiling and `--approve` for that run. No action approval carries to the next run. [Acting policy](docs/architecture/04-acting.md).

## Early evaluation results

Across four small TypeScript tasks using GPT-5.6 Sol at medium reasoning effort, the recorded preference scores were:

| Repository only (Bare) | Personal skills/context (Skills) | Skills/context + profile (Clone) |
| ---: | ---: | ---: |
| 55/68 (80.9%) | 59/68 (86.8%) | 62/68 (91.2%) |

These are guideline checks passed, not correctness or productivity scores. The skills were existing user-written or user-guided instructions, potentially outdated and not tuned for this comparison. This was one implementation per arm per task, with known judging limitations. Read [the tasks, setup, results, and caveats](evals.md) before drawing broader conclusions.

## Commands

| Command | Use |
| --- | --- |
| `shadowclone init [--advanced]` | Set consent and install detected integrations |
| `shadowclone import`, `shadowclone wizard` | Refresh repository guidance or seed choices |
| `shadowclone learn [--deep] [--dry-run] [--apply]` | Inspect history or reconcile guidance |
| `shadowclone skills`, `shadowclone skills update` | List starter guidance or maintain consented skills |
| `shadowclone skills pending`, `retry <key>`, `exclude <key> <reason>` | Inspect or resolve pending learning |
| `shadowclone skills automatic on|off` | Control supported automatic skill edits |
| `shadowclone learning enable|disable|status` | Control session learning |
| `shadowclone doctor`, `shadowclone context` | Inspect skill delivery |
| `shadowclone migrate skills` | Preview migration; apply, authorize maintenance, and activate explicitly |
| `shadowclone sync` | Refresh installed hooks and this repository's files |
| `shadowclone context --explain`, `shadowclone recall <query>` | Explain session-start context or retrieve scoped references |
| `shadowclone profile repair [--decisions <file>] [--apply]` | Legacy profile repair before skills migration |
| `shadowclone migrate claude-memory` | Legacy one-time import before skills migration |
| `shadowclone init --repo [--personal\|--no-personal] [--skill <name>] [--no-enforce]` | Set up this repository with committable files |
| `shadowclone check [--changed] [--format human\|json\|claude-stop]` | Check the repository files and conventions; run by the Claude Stop hook and CI |
| `shadowclone install [--agent <agent>|all] [--global|--local]` | Install native guidance manually; `--local` limits it to this repository without committed files |
| `shadowclone uninstall [--global]` | Remove owned integrations |
| `shadowclone remember`, `history`, `undo` | Manage direct rules and revisions |
| `shadowclone eval`, `shadowclone run <task>` | Measure transfer or run a local clone |
| `shadowclone forget --all` | Remove all recorded Shadowclone state |

Contributors can run `bun install` and `bun run check`. See [the architecture](docs/architecture/README.md), [design records](docs/design/README.md), [contribution guide](CONTRIBUTING.md), and [security policy](SECURITY.md). Shadowclone is MIT licensed.
