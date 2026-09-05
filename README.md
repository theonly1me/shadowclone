# shadowclone

shadowclone becomes you. It learns how you work from the AI coding sessions already on your disk, then runs as you: a subagent that plans, codes, and verifies the way you do, spawned in parallel inside the agent you already use, on the subscription you already pay for.

Claude Code, Codex, and Cursor write every session to disk. On one machine that is 372 sessions holding 994 interruptions, 445 refused tool calls, and 313 answered questions, every one a moment where you overrode the agent. shadowclone reads them, offline, and builds a profile of how you actually engineer. That profile compiles into a system prompt for your live sessions and into a `.claude/agents/<you>.md` subagent, so `Agent(subagent_type: "<you>")` dispatches a copy of you onto a task, and ten of them onto ten tasks. When you are away, `shadowclone run` does the same in a worktree.

The name is the Naruto reference. A shadow clone is a copy that goes off and does your work while you do something else, and everything it learned comes back to you when it dissolves. That is what this is. The profile is how a clone knows what you would have done, and the replay eval is how you know whether to trust it.

## Status

Early, and the honest version matters more here than anywhere else in this file.

`main` still runs the first prototype: `src/collector.ts` reads shell history, `src/redact.ts` scrubs it, `src/distiller.ts` sends it to OpenAI, and `src/index.ts` prints what came back. That prototype is being replaced, not extended. Shell history turned out to be the wrong input and an API key turned out to be the wrong ask.

The replacement is specified in `docs/design/001-agent-transcript-pivot.md` and builds in phases. Phase 0, which adds `src/paths.ts`, `src/config/`, and the `src/redact/` folder split, is in review. Phases 1 through 5, transcript capture, the profile, the clone inside your session, the clone while you are away, and more providers, are not started. Nothing on `main` reads a transcript, builds a profile, or acts on your behalf yet.

Everything below describes shadowclone as designed. Where a sentence is about what runs today, it says so.

## Privacy

This is the first question anyone should ask about a program that reads their AI agent transcripts, so it goes here rather than at the bottom. Transcripts hold more than shell history ever did: source code, hostnames, production log output, and the contents of files you opened by accident.

**What it reads.** Every source is opt-in, off by default, and listed here. The list grows only when a release note says it grew.

| Source | Path | Default | On `main` today |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude/projects/**/*.jsonl` | off | not read |
| `claude-prompts` | `~/.claude/history.jsonl` | off | not read |
| `codex` | `~/.codex/sessions/**/*.jsonl` | off | not read |
| `cursor` | `~/.cursor/chats/**/store.db` | off | not read |
| `shell` | `~/.zsh_history`, `~/.bash_history` | off | read by the prototype, last 100 lines of each |

A disabled source is never opened, not even to check whether it exists.

**What leaves your machine.** shadowclone has no server, no account, and no API key. Model requests go to the agent CLI you already have installed and authenticated, `claude`, `codex`, or `cursor-agent`, on your own account and plan, so nothing goes anywhere your own agent is not already sending it. Pointed at a local Ollama endpoint, nothing leaves at all. `shadowclone learn` without `--deep` makes no network call and says so on its first line. There is no telemetry, no analytics, and no crash reporting. On `main` today the prototype sends redacted shell history to OpenAI, which is the behaviour being removed.

**What gets scrubbed before that.** Provider API keys, GitHub tokens, Slack tokens, AWS access key ids, JWTs, `Authorization` headers, PEM blocks, any assignment whose name looks like a secret, and your home directory path. `src/redact.test.ts` is the list, in executable form, and it grows to cover paths, hostnames, emails, and cloud resource ids when transcript capture lands. Scrubbing is deliberately over-eager. A false positive costs a rule some context and a false negative costs you a credential.

**What is never read at all.** The contents of tool results, file contents from Read, Edit, or Write, thinking blocks, and any result from a data-access tool. Those fields hold other people's data, production log lines and database rows, and no pattern reliably finds a customer's email in a log dump. So that data is excluded by category rather than redacted. `docs/architecture/07-enterprise.md` has the full list.

**What is stored.** Everything lives under `~/.shadowclone/`: a rebuildable SQLite index of pointers into your transcripts, never the text, and a profile in plain markdown you can open, edit, and argue with. shadowclone never makes a second copy of your transcripts. Nothing is synced or uploaded. `shadowclone forget --all` removes all of it in one step. Nothing is stored on `main` today.

**What stays inside your organization.** Every rule remembers which git remote it was learned from and is only loaded into sessions on repos from the same organization. A rule learned in your employer's repo does not follow you to a personal one. An administrator can constrain or disable shadowclone fleet-wide with a root-owned policy file.

**What it does on your behalf.** Inside your own session, a subagent runs under that session's permission mode with you present. Unattended, the ceiling is a branch and a commit in a worktree until you allowlist a repo for more. Pushing, opening a pull request, replying, and spending are each gated per repo, and `bypassPermissions` is never passed at any tier. Nothing acts on `main` today.

If you find a case where a secret gets through the redaction, that is the highest-value bug report this project can receive. Open an issue with the shape of the string rather than the string itself.

## Quickstart

Needs [Bun](https://bun.sh) and, for anything that calls a model, at least one of `claude`, `codex`, or `cursor-agent` installed and logged in. No API key.

```bash
git clone https://github.com/theonly1me/shadowclone.git
cd shadowclone
bun install
bun run typecheck && bun test
```

That is everything that runs on `main` today. The commands below land with the phases named in `docs/architecture/06-roadmap.md`.

```bash
shadowclone init          # consent, detect engines, write config      (Phase 1)
shadowclone learn         # build your profile, offline                 (Phase 2)
shadowclone learn --deep  # distil through your own agent subscription  (Phase 3)
shadowclone run "<task>"  # a clone in a worktree while you are away    (Phase 4)
shadowclone forget --all  # the one-step wipe                           (Phase 1)
```

## How it works

```
observe  ->  index  ->  signal  ->  distill  ->  profile  ->  dispatch
```

| Stage | Module | What it does |
| --- | --- | --- |
| observe | `src/observe/` | normalizes agent transcripts into one event stream, incrementally |
| index | `src/index/` | a rebuildable SQLite cache of pointers, never text |
| signal | `src/signal/` | finds where you overrode the agent, in pure code, no model |
| distill | `src/distill/` | turns those moments into written rules through your own agent CLI |
| profile | `src/profile/` | plain markdown you can read, plus a subagent that is you |
| dispatch | `src/dispatch/` | runs a clone in a worktree and leaves a receipt |
| engine | `src/engine/` | the one place a model is called, always through the CLI you already have |

Events carry a pointer to transcript text, never the text, and the only function that turns a pointer into a string redacts on the way. That is what makes the egress gate structural rather than a call someone has to remember.

None of these modules exist on `main` yet. `docs/architecture/` has the reasoning behind each decision, `07-enterprise.md` is written for whoever has to approve this on a work laptop, and `08-landscape.md` says what already exists elsewhere and where this differs.

## Contributing

`CONTRIBUTING.md` has the setup and the rules. The short version: keep the diff small, run `bun run typecheck && bun test`, and keep the PR description under 250 words, since `.github/pull_request_template.md` is strict on purpose.

Anything touching capture, storage, or network egress gets a closer read than the rest of the codebase. `.claude/skills/data-handling/SKILL.md` says why and lists what a reviewer will check.

## License

MIT. See `LICENSE`.
