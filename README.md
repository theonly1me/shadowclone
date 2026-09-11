# shadowclone

Teach your coding agents to work the way you do.

Shadowclone learns how you work from the AI coding sessions already on your disk, then compiles an editable profile for the agents you already use. The goal is a clone that can reason about work and carry it out the way you would.

Today it imports existing repository guidance, observes enabled Claude Code, Codex, Cursor, and Antigravity transcripts, and reports steering signals without rewriting your profile. Explicit deep learning reconciles eligible moments with the guidance and rejections you already own, then proposes local Markdown changes for review. No measured outcome is published yet.

Run the evaluation instrument on your own corpus:

```bash
shadowclone eval --tasks 5 --engine codex
```

## What Shadowclone is

**Not an agent runtime.**
Shadowclone does not provide an LLM chat loop, an autonomous worker daemon, or an IDE extension. It compiles behavioral profiles and subagents for the agent CLIs you already install, authenticate, and pay for.

**A behavioral profile compiler.**
Every turn where you interrupted an agent, refused a tool, corrected a proposal, or chose one implementation over another is evidence about how you work. Shadowclone indexes those moments locally and distills them into plain Markdown rules scoped by the remote owner they came from.

## The pipeline

```
observe  ->  index  ->  signal  ->  report
                           |
                           +->  distill  ->  profile  ->  dispatch / eval
                                 ^             ^
                    user's subscription       |
declared repository guidance  ->  redact  -----+
```

| Stage | Module | Function |
| --- | --- | --- |
| observe | `src/observe/` | Normalizes agent transcripts into one incremental event stream |
| index | `src/index/` | Rebuildable SQLite cache of byte offsets and event kinds, never text |
| signal | `src/signal/` | Detects interruptions, plan changes, and tool refusals in pure code |
| report | `src/profile/mirror.ts` | Shows aggregate behavior and previews deep-learning work without writing profile rules |
| distill | `src/distill/` | Reconciles high-signal moments with existing guidance via your installed agent CLI |
| import | `src/importRules/` | Redacts supported repository instructions and synchronizes one rule per file |
| profile | `src/profile/` | Plain Markdown rules and subagents scoped globally, by remote owner, or by exact repository |
| dispatch | `src/dispatch/` | Executes unattended tasks on isolated worktrees with receipts |
| eval | `src/eval/` | Runs qualifying tasks at historical commits and compares baseline and clone correctness and preference adherence |

Model calls run through `claude`, `codex`, or `cursor-agent`. There is no shadowclone API key, no telemetry, and no hosted server.

## Capability matrix

Implementation support is tracked separately for each use. A provider appearing in one column does not imply support in another.

| Provider | Observe | Deep distill | Live clone | Headless dispatch | Transfer eval |
| --- | --- | --- | --- | --- | --- |
| Claude Code | yes | yes | yes | yes | yes |
| Codex | yes | yes | no | no | yes |
| Cursor | yes | yes | no | no | no |
| Antigravity | yes | no | no | no | no |

`shadowclone doctor` checks installed and authenticated engines. Provider compatibility, plugin installation, and authenticated engine runs require separate verification.

## Quickstart

Install the global CLI:

```bash
npm i -g @shadowclone/cli
```

Verify your environment and supported provider CLIs:

```bash
shadowclone doctor
```

Inspect the seed guidance available for onboarding:

```bash
shadowclone skills
```

The library separates eight short profile preferences from ten complete Agent Skills. Preferences record choices such as planning threshold and question frequency. Skills provide task-specific processes, guardrails, and completion criteria for testing, diagnosis, research, design, conflict resolution, scoped changes, TypeScript, and final verification.

Agent Skills use the standard `skills/<name>/SKILL.md` layout with routing descriptions. The strict zero-comment rule from this repository is not a general onboarding option. Listing package guidance does not inspect or change your profile. Onboarding asks for one choice from each of the five guidance axes and an explicit set of eight optional skills.

Build a declared profile, then grant consent for desired sources and capabilities:

```bash
shadowclone init
```

When the working directory contains `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.claude/skills/*/SKILL.md`, or `.agents/skills/*/SKILL.md`, `init` offers to import that guidance before reading it. Acceptance stores `declared-rules` consent and imports each supported file as one redacted profile rule. Declining import offers the seed wizard separately. When no supported guidance is detected, `init` runs the profile wizard first. Capture consent always comes after this profile step.

Only transcript and history sources with a non-empty configured root receive a consent question. Every source remains off until it is enabled here. Two additional capabilities read files that are neither transcripts nor history:

Before consent, onboarding may check whether a configured source root exists and is non-empty. It keeps only that boolean so it can omit absent providers from its questions. It does not retain or log a source path, entry name, count, timestamp, size, or provider-derived identifier.

- **`declared-rules`** reads only the supported repository guidance paths after consent. Imports are local and deterministic, call no model, and store only redacted content plus opaque synchronization identifiers.
- **`git-metadata`** reads the git remote origin of a working directory, so rules can be scoped to the `host/owner` or exact repository they came from. Without it every directory is treated as its own isolated origin. Previously observed session bindings persist across index migrations. Unbound sessions predating the current index stay isolated because their historical owner cannot be established.
- **`agent-context`** reads the user's own `CLAUDE.md` or `AGENTS.md`, their skill markdown, and their agent memory directory. It exists so a transfer evaluation can freeze the same setup for both arms, and it is read only by `shadowclone eval`. Contents pass through redaction before they are written into a snapshot.

Import or synchronize repository guidance without repeating the rest of onboarding:

```bash
shadowclone import
```

The first run asks once and persists consent. Later runs update unedited imports under the same identity, preserve profile edits, keep deleted rules rejected, and retire unedited rules whose source file disappeared. Enabling Git metadata later moves the same unedited rule from an isolated working-directory scope to an exact repository scope.

Rerun only the profile choices at any time:

```bash
shadowclone wizard
```

The rerun preserves edited rules and prior deletions. Confirming a different option retires the unedited seed rule it replaces. It does not repeat capture consent.

Index your historical sessions and inspect the behavioral report:

```bash
shadowclone learn
```

Plain learning updates the local disposable index, prints aggregate session, origin, correction, and deep-learning batch counts, and leaves the profile unchanged.

To preview without writing files or databases:

```bash
shadowclone learn --dry-run
```

To reconcile eligible correction moments with your existing profile through your authenticated agent CLI:

```bash
shadowclone learn --deep
```

Deep learning shows reinforcement, contradiction, narrowing, and new-rule proposals, then asks once before writing. Declared, imported, and user-owned rules remain active during disagreement. Mined guidance becomes active after support from three independent sessions; earlier guidance remains a candidate. Pass `--deep --dry-run` to run the same bounded analysis without writing the index, checkpoints, or profile, or `--deep --apply` to accept the displayed changes without the prompt.

One deep-learning invocation can attempt at most 20 model calls over five minutes. Reconciliation and merge share that allowance. Claude also receives a cumulative $2 ceiling. Codex and Cursor do not support a dollar-budget flag, so Shadowclone omits it and keeps their runs bounded by calls and time. Completed checkpoints are bound to the redacted prompt, schema, and learner version so an unchanged invocation can resume safely.

Install the compiled profile into the current repository:

```bash
shadowclone install
shadowclone install --auto-delegate
shadowclone uninstall
```

Install writes `.claude/agents/shadowclone.md` and excludes it from git tracking. Pass `--auto-delegate` to also write a `.claude/skills/shadowclone/SKILL.md` workflow that hands bounded parallel work to the clone as a written brief. That routing is a choice you make, not something Shadowclone learned, so it stays off by default.

One compiler produces every clone. It selects global guidance, the matching remote owner, and the project file for this repository. Each input file is bounded and materialized once. Selection is deterministic for identical inputs. User-written, declared, and imported guidance ranks ahead of mined guidance, two active choices from the same seed axis cannot both reach an agent, and unsupported or stale mined rules stay out. Each block carries its source and its stated conditions. The output is capped at 16 KiB and only whole blocks are dropped, so no rule is ever cut mid-sentence.

`shadowclone uninstall` removes recorded files whose content still matches the installation fingerprint and the exclude lines it added. Modified, unrelated, and unverifiable files remain.

The profile is yours to correct. Editing the visible text of a generated or imported block makes it active user guidance and preserves your version verbatim. Reconciliation can add evidence and a proposal to that metadata without replacing your text. Deleting a rule records its persistent id and last generated text in `.rejected`; deep learning sees a redacted, opaque view of those rejections and omits proposed paraphrases it identifies as equivalent.

## Transfer evaluation

Shadowclone measures whether the profile changes behavior, against tasks the user actually asked for:

```bash
shadowclone eval --tasks 5 --engine codex
```

The evaluator selects historical requests that name an identifiable starting commit, rebuilds each one as an isolated git snapshot at that commit, and runs the task twice:

1. **Baseline run:** the agent with frozen instructions and no profile.
2. **Clone run:** the same agent with the profile learned from sessions strictly earlier than the task.

Arm order alternates between repetitions, and the profile is learned only from evidence that predates the task and shares no session with it.

Each run is graded two ways. The repository's own `test` and `typecheck` scripts run inside a `sandbox-exec` or `bubblewrap` boundary with no network. A blind judge then grades the observed files and actions twice with the requirement order reversed, and disagreements between the two passes are recorded as uncertain.

Interactive runs preview invocation limits and budget behavior before starting. Claude defaults to a $2 total requested budget shared across all evaluation phases and retries. Codex uses call and time limits and rejects dollar caps. Provider billing may exceed a limit during an in-flight request. Pass `--yes` to skip the prompt, or `--json` for a reduced machine-readable report.

Private frozen inputs are saved in `~/.shadowclone/eval/<evalId>/state.json`, cumulative usage in `budget.json`, and reduced metrics in `report.json`. `--eval-id <id>` resumes compatible state without resetting its budget. Older state without trustworthy accounting is rejected. Do not share private state files.

## Unattended dispatch

Execute tasks in an isolated git worktree without touching your working tree:

```bash
shadowclone run "fix the flaky test in src/auth.test.ts"
```

The default dispatch mode creates a local worktree and branch, permits the agent to run verification commands detected from project manifests, and commits a successful engine result locally without pushing. Shadowclone does not yet prove that the agent ran those checks.

Remote actions (push, open PR) require both a repository ceiling in `~/.shadowclone/config.toml` and an explicit per-run approval flag:

```toml
[repo."github.com/acme/project"]
allow = ["push", "pr-draft"]
maxBudgetUsd = 2.00
```

Repository ceilings use the full `host/owner/repository` identity and require the `git-metadata` source. Without that consent, the working directory receives an isolated identity and cannot match this entry.

```bash
shadowclone run "prepare release notes" --approve push
shadowclone run "open a draft for the fix" --approve push --approve pr-draft
shadowclone run "reply with the findings" --approve pr-reply --pr 123
```

GitHub actions run through host helpers scoped to the approved repository. PR replies require an explicit PR number. The agent does not receive a GitHub token or unrestricted `gh` tools.

## Data handling

[Data handling](docs/data-handling.md) describes consent, local storage, provider requests, retention, deletion, and execution permissions. [SECURITY.md](SECURITY.md) explains reporting and the supported boundaries.

The index stores metadata and pointers instead of whole transcript text. Selected and derived content can remain in profiles, checkpoints, and private evaluation state. Generated state uses private filesystem permissions, not encryption.

Learning excludes tool-result payloads and thinking blocks. Eligible prompts and assistant context can still contain sensitive information. Pattern redaction can miss secrets or confidential prose and can remove harmless text; it is not comprehensive personal-data or credential detection.

Remove Shadowclone's local data with:

```bash
shadowclone forget --all
```

This deletes its worktrees too, including unfinished work. It attempts removal of matching recorded repository installs and preserves modified or unverifiable artifacts. Source transcripts, remote branches and PRs, provider copies, backups, and Git history remain. Older installations without fingerprints may require manual cleanup.

## Enterprise governance

Security teams can configure ceilings for this installation via root-owned managed configuration:

- **macOS:** `/Library/Application Support/shadowclone/managed.json`
- **Linux:** `/etc/shadowclone/managed.json`

```json
{
  "enabled": true,
  "allowedSources": ["claude-code"],
  "allowedEngines": ["claude-code"],
  "distillation": "allowed",
  "originScope": "strict",
  "blockedOrigins": ["github.com/acme/security-*"],
  "maxActionTier": "draft"
}
```

Managed policies act as an absolute ceiling. Users cannot enable unapproved sources or engines, and `enabled: false` enforces an immediate stop across the machine.

## CLI commands

```bash
shadowclone init                                 # Import or choose a profile, then configure consent
shadowclone import                               # Import or synchronize repository guidance
shadowclone wizard                               # Rerun declared profile choices
shadowclone skills                               # List packaged behavioral dispositions
shadowclone learn [--deep] [--dry-run] [--apply] # Report sessions or reconcile profile guidance
shadowclone doctor                               # Inspect active paths, engines, and policies
shadowclone install [--auto-delegate]            # Install profile as .claude/agents/shadowclone.md
shadowclone uninstall                            # Remove this repository's shadowclone files
shadowclone run <task> [--approve <action>]      # Dispatch headless clone in a worktree
shadowclone eval [--tasks N] [--json]            # Compare baseline and clone on qualifying tasks
shadowclone mcp                                  # Start stdio Model Context Protocol server
shadowclone forget --all                         # Delete local state and matching recorded installs
```

## Contributing

Review `CONTRIBUTING.md` and `SECURITY.md`. All contributions must pass:

```bash
bun run check
```

## License

MIT. See `LICENSE`.
