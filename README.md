# shadowclone

Teach your coding agents to work the way you do.

Shadowclone learns how you work from the AI coding sessions already on your disk, then compiles an editable profile for the agents you already use. The goal is a clone that can reason about work and carry it out the way you would.

Today it observes enabled Claude Code, Codex, Cursor, and Antigravity transcripts, finds steering signals, writes a local Markdown profile, and can run an evaluation that compares profiled and unprofiled behavior. The next milestone reconciles instructions you wrote with corrections you made during real work. No measured outcome is published yet.

Run the evaluation instrument on your own corpus:

```bash
shadowclone eval --sessions 10
```

## What Shadowclone is

**Not an agent runtime.**
Shadowclone does not provide an LLM chat loop, an autonomous worker daemon, or an IDE extension. It compiles behavioral profiles and subagents for the agent CLIs you already install, authenticate, and pay for.

**A behavioral profile compiler.**
Every turn where you interrupted an agent, refused a tool, corrected a proposal, or chose one implementation over another is evidence about how you work. Shadowclone indexes those moments locally and distills them into plain Markdown rules scoped by the remote owner they came from.

## The pipeline

```
observe  ->  index  ->  signal  ->  distill  ->  profile  ->  dispatch / eval
                          |                        |
                     zero tokens          user's subscription
```

| Stage | Module | Function |
| --- | --- | --- |
| observe | `src/observe/` | Normalizes agent transcripts into one incremental event stream |
| index | `src/index/` | Rebuildable SQLite cache of byte offsets and event kinds, never text |
| signal | `src/signal/` | Detects interruptions, plan changes, and tool refusals in pure code |
| distill | `src/distill/` | Distills high-signal moments into rules via your installed agent CLI |
| profile | `src/profile/` | Plain Markdown rules and subagents scoped to remote owners |
| dispatch | `src/dispatch/` | Executes unattended tasks on isolated worktrees with receipts |
| eval | `src/eval/` | Replays historical prompts through baseline vs clone to score behavioral deltas |

Model calls run through `claude`, `codex`, or `cursor-agent`. There is no shadowclone API key, no telemetry, and no hosted server.

## Capability matrix

Implementation support is tracked separately for each use. A provider appearing in one column does not imply support in another.

| Provider | Observe | Deep distill | Live clone | Headless dispatch | Transfer eval |
| --- | --- | --- | --- | --- | --- |
| Claude Code | yes | yes | yes | yes | yes |
| Codex | yes | yes | no | no | yes |
| Cursor | yes | yes | no | no | no |
| Antigravity | yes | no | no | no | no |

`shadowclone doctor` checks installed and authenticated engines. Real provider corpora, plugin installation, and authenticated engine runs remain manual verification steps.

## Quickstart

Install the global CLI:

```bash
npm i -g @shadowclone/cli
```

Verify your environment and supported provider CLIs:

```bash
shadowclone doctor
```

Grant consent for desired transcript sources:

```bash
shadowclone init
```

Every source is off until it is enabled here, and two of them read files that are not transcripts:

Before consent, onboarding may check whether a configured source root exists and is non-empty. It keeps only that boolean so it can omit absent providers from its questions. It does not collect entry names, open an entry, or retain or log a source path, name, count, timestamp, or provider identifier.

- **`git-metadata`** reads the git remote origin of a working directory, so rules can be scoped to the `host/owner` they were learned from. Without it every directory is treated as its own isolated origin.
- **`agent-context`** reads the user's own `CLAUDE.md` or `AGENTS.md`, their skill markdown, and their agent memory directory. It exists so a transfer evaluation can freeze the same setup for both arms, and it is read only by `shadowclone eval`. Contents pass through redaction before they are written into a snapshot.

Index your historical sessions and build your profile:

```bash
shadowclone learn
```

To preview without writing files or databases:

```bash
shadowclone learn --dry-run
```

To enable deep distillation through your authenticated agent CLI:

```bash
shadowclone learn --deep
```

Install the compiled profile into the current repository:

```bash
shadowclone install
```

This writes `.claude/agents/shadowclone.md` and excludes it from git tracking.

The profile is yours to correct. Editing the visible text of a generated block pins it, so later learning preserves your version verbatim. Deleting a generated block records its key in `.rejected`, so that exact generated rule is not written again. Paraphrase-aware rejection is part of the reconciliation milestone and is not implemented yet.

## Transfer evaluation

Shadowclone measures whether the profile changes behavior, against tasks the user actually asked for:

```bash
shadowclone eval --tasks 5 --engine codex
```

The evaluator selects historical requests that name an identifiable starting commit, rebuilds each one as an isolated git snapshot at that commit, and runs the task twice:
1. **Baseline run:** the agent with frozen instructions and no profile.
2. **Clone run:** the same agent with the profile learned from sessions strictly earlier than the task.

Arm order alternates between repetitions, and the profile is learned only from evidence that predates the task and shares no session with it.

Each run is graded two ways. The repository's own `test` and `typecheck` scripts run inside a `sandbox-exec` or `bubblewrap` boundary with no network. A blind judge then grades the observed files and actions twice with the requirement order reversed, and any disagreement between the two passes is recorded as uncertain rather than resolved.

The command previews how many agent invocations it may spend and asks before starting. Pass `--yes` to skip the prompt, or `--json` for machine-readable output.

Receipts are written to `~/.shadowclone/eval/<evalId>/receipt.json` after every run, so `--eval-id <id>` resumes an interrupted evaluation against the same frozen tasks.

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
```

## Ground-truth privacy

Agent transcripts contain private code, environment variables, internal hosts, and customer data. Shadowclone protects data through structural guarantees:

**Pointers instead of text copies.**
The SQLite index stores file offsets, timestamps, and event kinds. Raw transcripts are never duplicated to a secondary store.

**Sliced secret redaction.**
Distillation excerpts pass through a deterministic sliced replacer before reaching any model. Secrets keep identifying prefixes (such as `AKIA` or `sk_live_`) while stripping high-entropy characters, keeping code context intact without leaking credentials.

**Shannon entropy layer.**
Tokens of 24 characters or more that reach 4.5 bits of entropy per character are sliced under the `shannon-entropy` label, even when they match no known vendor pattern. Long identifiers, file paths, and UUIDs measure below that threshold and stay readable.

**Third-party tool results are excluded.**
Distillation inputs allowlist user prompts and developer steering corrections. Tool outputs from database queries, log dumps, and file reads are excluded by category rather than relying on regex filtering.

**Shadowclone home wipe.**
Remove the local index, profile, checkpoints, receipts, and worktrees under `~/.shadowclone/`:

```bash
shadowclone forget --all
```

Repository-local `.claude/agents/shadowclone.md`, `.claude/skills/shadowclone/SKILL.md`, and `.git/info/exclude` entries created by `shadowclone install` remain until uninstall support lands.

## Enterprise governance

Security teams can enforce policy ceilings fleet-wide via root-owned managed configuration:
- **macOS:** `/Library/Application Support/shadowclone/managed.json`
- **Linux:** `/etc/shadowclone/managed.json`

```json
{
  "enabled": true,
  "allowedSources": ["claude-code"],
  "allowedEngines": ["claude-code"],
  "distillation": "local-only",
  "originScope": "strict",
  "blockedOrigins": ["github.com/acme/security-*"],
  "maxActionTier": "draft"
}
```

Managed policies act as an absolute ceiling. Users cannot enable unapproved sources or engines, and `enabled: false` enforces an immediate stop across the machine.

## CLI commands

```bash
shadowclone init                                 # Configure source consent and capabilities
shadowclone learn [--deep] [--dry-run]           # Index sessions and synthesize rules
shadowclone doctor                               # Inspect active paths, engines, and policies
shadowclone install                              # Install profile as .claude/agents/shadowclone.md
shadowclone run <task> [--approve <action>]      # Dispatch headless clone in a worktree
shadowclone eval [--sessions N] [--json]         # Measure behavioral deltas against baseline
shadowclone mcp                                  # Start stdio Model Context Protocol server
shadowclone forget --all                         # Remove ~/.shadowclone/ completely
```

## Contributing

Review `CONTRIBUTING.md` and `SECURITY.md`. All contributions must pass:

```bash
bun run check
```

## License

MIT. See `LICENSE`.
