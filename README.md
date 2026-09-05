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

- **Works.** The first prototype. `src/collector.ts` reads shell history, `src/redact.ts` scrubs it, `src/distiller.ts` sends it to OpenAI. It is being replaced, not extended.
- **In review.** Phase 0: `src/paths.ts`, `src/config/`, and the `src/redact/` split.
- **Not started.** Everything in the table above. Nothing reads a transcript, builds a profile, or acts yet.

`docs/design/001-agent-transcript-pivot.md` is the spec. `docs/architecture/06-roadmap.md` is the order.

## Privacy

This is the first question to ask about a program that reads your agent transcripts, so it goes here rather than at the bottom.

**What it reads.** Every source is opt-in and off by default. The list grows only when a release note says it grew.

| Source | Path | Default | On `main` today |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude/projects/**/*.jsonl` | off | not read |
| `claude-prompts` | `~/.claude/history.jsonl` | off | not read |
| `codex` | `~/.codex/sessions/**/*.jsonl` | off | not read |
| `cursor` | `~/.cursor/chats/**/store.db` | off | not read |
| `shell` | `~/.zsh_history`, `~/.bash_history` | off | read by the prototype |

**What leaves your machine.** Only what your own agent CLI sends, under your own account. shadowclone has no server, no account, and no key. `shadowclone learn` makes no network call at all. No telemetry, no analytics, no crash reporting.

**What gets scrubbed.** API keys, GitHub and Slack tokens, AWS key ids, JWTs, `Authorization` headers, PEM blocks, secret-looking assignments, and your home path. `src/redact.test.ts` is the list. It is over-eager on purpose.

**What is never read.** Tool results, file contents, thinking blocks, and anything from a data-access tool. Those hold other people's data, so they are excluded outright rather than redacted. `docs/architecture/07-enterprise.md` has the list.

**What is stored.** `~/.shadowclone/` only: a rebuildable index of pointers and a profile in plain markdown. No second copy of your transcripts. Never synced. `shadowclone forget --all` removes everything.

**What stays in your org.** A rule remembers which git remote it came from and only loads into repos from the same organization. An admin can disable shadowclone fleet-wide with a root-owned file.

**What it does on your behalf.** Inside your session, a subagent runs under that session's permissions with you watching. Unattended, it can commit to a branch in a worktree and nothing more until you allowlist a repo. `bypassPermissions` is never passed.

If a secret gets past the redaction, that is the highest-value bug report this project can get. Open an issue with the shape of the string, not the string itself.

## Quickstart

Needs [Bun](https://bun.sh). For anything that calls a model, one of `claude`, `codex`, or `cursor-agent` logged in. No API key.

```bash
git clone https://github.com/theonly1me/shadowclone.git
cd shadowclone
bun install
bun run typecheck && bun test
```

That is all that runs on `main` today. These land by phase:

```bash
shadowclone init          # consent, detect engines            (Phase 1)
shadowclone learn         # build your profile, offline        (Phase 2)
shadowclone learn --deep  # distil through your own agent      (Phase 3)
shadowclone run "<task>"  # a clone in a worktree              (Phase 4)
shadowclone forget --all  # wipe                               (Phase 1)
```

## Contributing

`CONTRIBUTING.md` has the rules. Short version: small diffs, `bun run typecheck && bun test`, PR body under 250 words.

Anything touching capture, storage, or egress gets a closer read. `.claude/skills/data-handling/SKILL.md` says what a reviewer checks.

## License

MIT. See `LICENSE`.
