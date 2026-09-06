# shadowclone

Memory and alignment compiler for AI coding agents.

Shadowclone reads historical coding sessions already on your disk (Claude Code, Codex, Cursor), mines your steering habits without sending raw transcripts to any server, and compiles an editable profile into the agents you already use.

Developers who install the profile see a measurable action delta against unprofiled runs on their held-out corpus: the agent stops asking for confirmations you never gave, runs the tests you run, and avoids the tools you refuse.

Verify the delta directly on your own machine:

```bash
shadowclone eval --sessions 10
```

## Architectural scope: what shadowclone is and is not

**Not an agent runtime.**
Shadowclone does not provide an LLM chat loop, an autonomous worker daemon, or an IDE extension. It compiles behavioral profiles and subagents for the agent CLIs you already install, authenticate, and pay for.

**A memory and alignment compiler.**
Every turn where you interrupted an agent, refused a tool, corrected a proposal, or chose one implementation over another is an alignment signal. Shadowclone indexes those moments locally and distills them into plain markdown rules scoped by repository origin.

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
| profile | `src/profile/` | Plain markdown rules and subagents scoped to git origins |
| dispatch | `src/dispatch/` | Executes unattended tasks on isolated worktrees with receipts |
| eval | `src/eval/` | Replays historical prompts through baseline vs clone to score behavioral deltas |

Model calls run through `claude`, `codex`, or `cursor-agent`. There is no shadowclone API key, no telemetry, and no hosted server.

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

## Replay evaluation

Shadowclone provides a reproducible fitness function to measure profile impact:

```bash
shadowclone eval --sessions 5 --max-budget-usd 0.50
```

The evaluator replays historical user prompts through two isolated runs:
1. **Baseline run:** unprofiled agent invocation without system prompt customization.
2. **Clone run:** agent invocation with the compiled project profile injected.

Replays are compared against historical developer actions across four dimensions:
- **Tools:** Jaccard similarity of invoked tools.
- **Verification:** Jaccard similarity of two-token bash verification commands (e.g. `bun test`, `cargo check`).
- **Files:** Jaccard similarity of posix repository-relative edited paths.
- **Planning:** Match on whether planning tools were invoked before the first file edit.

Evaluation receipts are written to `~/.shadowclone/eval/<evalId>.json`.

## Unattended dispatch

Execute tasks in an isolated git worktree without touching your working tree:

```bash
shadowclone run "fix the flaky test in src/auth.test.ts"
```

The default dispatch mode creates a local worktree and branch, runs verification checks, and commits locally without pushing.

Remote actions (push, open PR) require both a repository ceiling in `~/.shadowclone/config.toml` and an explicit per-run approval flag:

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
Unstructured tokens exceeding 4.5 bits of entropy per character are scrubbed even if they do not match known vendor regex patterns.

**Third-party tool results are excluded.**
Distillation inputs allowlist user prompts and developer steering corrections. Tool outputs from database queries, log dumps, and file reads are excluded by category rather than relying on regex filtering.

**Single-command wipe.**
Wipe the entire local index, profile, checkpoints, and receipts:

```bash
shadowclone forget --all
```

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
