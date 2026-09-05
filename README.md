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

- **Built.** Phases 0 and 1. `shadowclone init` records consent, `shadowclone learn` incrementally indexes enabled Claude Code transcripts without storing their text, and `shadowclone forget --all` removes everything it created.
- **Not started.** The mirror, live-session clone, headless clone, and additional providers. Nothing derives a profile, calls a model, or acts yet.

`docs/design/001-agent-transcript-pivot.md` is the spec. `docs/architecture/06-roadmap.md` is the order.

## Privacy

This is the first question to ask about a program that reads your agent transcripts, so it goes here rather than at the bottom.

**What it reads.** Every source is opt-in and off by default. The list grows only when a release note says it grew.

| Source | Path | Default | Built today |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude/projects/**/*.jsonl` | off | read only when enabled |
| `claude-prompts` | `~/.claude/history.jsonl` | off | read only when enabled |
| `codex` | `~/.codex/sessions/**/*.jsonl` | off | not read |
| `cursor` | `~/.cursor/chats/**/store.db` | off | not read |
| `shell` | `~/.zsh_history`, `~/.bash_history` | off | read only when enabled |

**What leaves your machine.** Only what your own agent CLI sends, under your own account. shadowclone has no server, no account, and no key. `shadowclone learn` makes no network call at all. No telemetry, no analytics, no crash reporting.

**What gets scrubbed.** Secrets, private paths, internal hosts, emails, cloud resources, and database URLs. `src/redact/index.test.ts` is the list. It is over-eager on purpose.

**What is never read.** Tool results, file contents, thinking blocks, and anything from a data-access tool. Those hold other people's data, so they are excluded outright rather than redacted. `docs/architecture/07-enterprise.md` has the list.

**What is stored.** Everything lives under `~/.shadowclone/`. The current SQLite index contains pointers, event kinds, and tool metadata, never transcript text. The profile lands in Phase 2 as plain markdown. shadowclone never makes a second copy of your transcripts. Nothing is synced or uploaded. `shadowclone forget --all` removes all of it in one step.

**What stays in your org.** Phase 2 scopes every rule to the git remote it came from. An admin can disable shadowclone fleet-wide with a root-owned file.

**What it does on your behalf.** Nothing yet. Phase 3 adds a subagent under the current session's permission mode. Phase 4 adds unattended worktree runs behind per-repo policy, and `bypassPermissions` is never passed at any tier.

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
```

`learn` indexes today and grows the mirror in Phase 2. These commands land later:

```bash
shadowclone learn --deep  # distil through your own agent      (Phase 3)
shadowclone run "<task>"  # a clone in a worktree              (Phase 4)
```

## Contributing

`CONTRIBUTING.md` has the rules. Short version: small diffs, `bun run check`, PR body under 250 words.

`SECURITY.md` says what to report privately and how to verify a release download.

Anything touching capture, storage, or egress gets a closer read. `.claude/skills/data-handling/SKILL.md` says what a reviewer checks.

## License

MIT. See `LICENSE`.
