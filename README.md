# shadowclone

shadowclone reads the AI coding sessions already on your disk, builds a profile of how you work, and runs copies of you inside the agent you already use.

Claude Code, Codex, and Cursor write every session to a file. Those files hold every time you stopped the agent, refused a tool, or picked one option over another. shadowclone turns those moments into a profile, loads it into your live sessions, and compiles it into a subagent. The subagent is you. Spawn ten of them on ten tasks, or let one run in a worktree while you're away.

The name is the Naruto reference. A shadow clone does your work while you do something else, and what it learned comes back when it dissolves.

## How it works

```
observe  ->  index  ->  signal  ->  distill  ->  profile  ->  dispatch
```

| Stage | Module | Does |
| --- | --- | --- |
| observe | `src/observe/` | reads transcripts into one event stream, incrementally |
| index | `src/index/` | SQLite cache of pointers into those files, never the text |
| signal | `src/signal/` | finds where you overrode the agent, no model involved |
| distill | `src/distill/` | turns those moments into rules, through your own agent CLI |
| profile | `src/profile/` | markdown you can read, plus a subagent that is you |
| dispatch | `src/dispatch/` | runs a clone in a worktree and leaves a receipt |

There is no API key and no server. Model calls go through `claude`, `codex`, or `cursor-agent`, already installed and logged in, on your own plan. `docs/architecture/` has the reasoning behind each piece.

## Status

Early.

- **Built.** Phases 0 through 5. `shadowclone learn` reads enabled Claude Code, Codex, and Cursor sessions into one offline mirror, `learn --deep` selects an authenticated CLI, the plugin provides a live `shadowclone` subagent, and `shadowclone run` leaves unattended work on a local branch with a receipt.
- **Manual checks.** Real authenticated provider runs, plugin installation, and provider-specific corpus tuning still need to be exercised outside recorded fixtures. API and local endpoint engines remain later work.

`docs/design/001-agent-transcript-pivot.md` is the spec. `docs/architecture/06-roadmap.md` is the order.

### Provider coverage

Observe, distill, and dispatch are separate claims. An installed CLI is never capture consent, and an engine is not called for a purpose whose policy it cannot enforce.

| Provider | Observe | Distill | Dispatch |
| --- | --- | --- | --- |
| Claude Code | built | built | built |
| Codex | built | built | blocked on granular tool and budget controls |
| Cursor | built | built | blocked on granular tool and budget controls |
| Antigravity CLI | next | blocked on a per-run deny-all tool policy | blocked on granular tool and budget controls |
| Gemini CLI, Copilot CLI, OpenCode, Aider, Amp | planned, one reviewed provider at a time | capability dependent | capability dependent |

`docs/design/002-provider-expansion.md` defines the qualification gate and the registry that keeps these claims honest.

## Privacy

This is the first question to ask about a program that reads your agent transcripts, so it goes here rather than at the bottom.

**What it reads.** Every source is opt-in and off by default. The list grows only when a release note says it grew.

| Source | Path | Default | Built today |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude/projects/**/*.jsonl` | off | read only when enabled |
| `claude-prompts` | `~/.claude/history.jsonl` | off | read only when enabled |
| `codex` | `~/.codex/sessions/**/*.jsonl` | off | read only when enabled |
| `cursor` | `~/.cursor/chats/**/{store.db,meta.json}` | off | read only when enabled |
| `git-metadata` | observed repositories' local `remote.origin.url` | off | read only when enabled |
| `shell` | `~/.zsh_history`, `~/.bash_history` | off | read only when enabled |

**What leaves your machine.** Only what your own agent CLI sends, under your own account. `shadowclone learn` makes no network call. `shadowclone learn --deep` sends only redacted, allowlisted correction excerpts after separate consent. shadowclone has no server, account, key, telemetry, analytics, or crash reporting.

**What gets scrubbed.** Secrets, private paths, internal hosts, emails, cloud resources, and database URLs. `src/redact/index.test.ts` is the list. It is over-eager on purpose.

**What is never read.** Tool results, file contents, thinking blocks, and anything from a data-access tool. Those hold other people's data, so they are excluded outright rather than redacted. `docs/architecture/07-enterprise.md` has the list.

**What is stored.** Everything lives under `~/.shadowclone/`. The SQLite index contains pointers, event kinds, and tool metadata, never transcript text. The profile is plain markdown plus a generated-rule manifest containing only rule ids and relative profile paths. shadowclone never makes a second copy of your transcripts. Nothing is synced or uploaded. `shadowclone forget --all` removes all of it in one step.

**What stays in your org.** Every rule is scoped to the git remote it came from when `git-metadata` is enabled. Without that consent, each working directory is an isolated origin that never promotes a rule to global. An admin can disable shadowclone fleet-wide with a root-owned file.

**What it does on your behalf.** The live subagent runs inside your current Claude Code session and its permission mode. `shadowclone run "<task>"` explicitly approves one local worktree, branch, and commit for that task. A repo allowlist is only a ceiling for remote actions, and each run must also name an action with `--approve`. Learned denials stay advisory until observation can identify the denied action without storing raw tool input. Merge, force push, `bypassPermissions`, and `--dangerously-skip-permissions` are never allowed.

If a secret gets past the redaction, that is the highest-value bug report this project can get. Open an issue with the shape of the string, not the string itself.

## Quickstart

Needs [Bun](https://bun.sh). For anything that calls a model, one of `claude`, `codex`, or `cursor-agent` logged in. No API key.

```bash
git clone https://github.com/theonly1me/shadowclone.git
cd shadowclone
bun install
bun run check        # typecheck, lint, and tests
bun run cli init
bun run cli learn
bun run cli doctor
bun run cli learn --deep
bun run cli run "fix the flaky test"
```

Add this checkout as a local Claude Code marketplace, then install the plugin:

```text
/plugin marketplace add /path/to/shadowclone
/plugin install shadowclone@shadowclone
```

Run `shadowclone install` inside a repository before its next Claude Code session. It writes the scoped `.claude/agents/shadowclone.md`. The plugin injects the same profile at session start, refreshes the offline profile at session end, and exposes it through MCP.

The default run creates a worktree and local commit, writes a receipt under `~/.shadowclone/runs/`, and pushes nothing. Remote actions need both a matching `[repo."<host>/<owner>/<repo>"]` allowlist and an explicit per-run `--approve`.

## Contributing

`CONTRIBUTING.md` has the rules. Short version: small diffs, `bun run check`, PR body under 250 words.

`SECURITY.md` says what to report privately and how to verify a release download.

Anything touching capture, storage, or egress gets a closer read. `.claude/skills/data-handling/SKILL.md` says what a reviewer checks.

## License

MIT. See `LICENSE`.
