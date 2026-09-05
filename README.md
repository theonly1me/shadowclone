# shadowclone

Learns how you work from the AI coding sessions you already run, then does your work the way you would when you are not there.

There is nothing to keep running. Claude Code, Codex, and Cursor already write every session to disk. shadowclone reads what is already there.

The name is the Naruto reference. A shadow clone is a copy that goes off and does your work while you do something else, and everything it learned comes back to you when it dissolves. That is the goal here: something that picks up your habits from the way you actually work, so it can stand in for you on the things you would have done the same way anyway.

## Status

Early. Honest summary of what exists:

- **Works.** Reading shell history, scrubbing secrets out of it, sending it to a model, and getting back a structured description of a reusable practice it spotted.
- **Stub.** `src/vault.ts` is empty. Nothing is stored between runs yet.
- **Not started.** Nothing acts on your behalf, and nothing is learned from your agent sessions yet.

So right now it is a one-shot script that prints what it learned and forgets it. The interesting parts are ahead.

**A rewrite is designed and not yet built.** Shell history turned out to be the wrong input, and requiring an `OPENAI_API_KEY` turned out to be the wrong ask. The next version learns from the session transcripts your AI coding agents already write to disk, and acts by driving the agent CLI you are already logged into, so it needs no API key of its own. `docs/design/001-agent-transcript-pivot.md` is the change, and `docs/architecture/` is the shape it is heading toward. Everything described in this README is what runs today.

## Privacy

This is the first question anyone should ask about a program that reads their shell history, so it goes here rather than at the bottom.

**What it reads.** `~/.zsh_history` and `~/.bash_history`, the last 100 lines of each. That is the entire list. It grows only when a release note says it grew.

**What leaves your machine.** The captured history, after every pattern in `src/redact.ts` has run over it, goes to OpenAI so the model can distil it. Nothing else is sent anywhere. There is no telemetry, no analytics, and no crash reporting.

**What gets scrubbed before that.** Provider API keys, GitHub tokens, Slack tokens, AWS access key ids, JWTs, `Authorization` headers, PEM blocks, any shell assignment whose name looks like a secret, and your home directory path. `src/redact.test.ts` is the list, in executable form. The scrubbing is deliberately over-eager, because a false positive costs the model some context and a false negative costs you a credential.

**What is stored.** Nothing yet. When the vault lands it will be plain files in a directory you own and can read in a text editor, and a documented one-step wipe command will land in the same release.

**What it does on your behalf.** Nothing, currently. When that changes, sending, posting, committing, and spending will each ask first, every time.

If you find a case where a secret gets through the redaction, that is the highest-value bug report this project can receive. Open an issue with the shape of the string rather than the string itself.

## Quickstart

Needs [Bun](https://bun.sh).

```bash
git clone https://github.com/theonly1me/shadowclone.git
cd shadowclone
bun install
cp .env.example .env   # then add your OPENAI_API_KEY
bun run start
```

You should see it read your history, then print a distilled skill as JSON.

```bash
bun run dev          # hot reload
bun test             # tests
bun run typecheck    # types
```

## How it works

```
collect  ->  redact  ->  distill  ->  vault  ->  act
```

| Stage | File | What it does |
| --- | --- | --- |
| collect | `src/collector.ts` | reads the capture sources off disk |
| redact | `src/redact.ts` | scrubs secrets, the single gate before anything leaves |
| distill | `src/distiller.ts` | asks a model what reusable practice it sees |
| vault | `src/vault.ts` | stores what was learned (not built yet) |
| act | none | uses it (not built yet) |

`docs/architecture/` has the longer version, the reasoning behind each decision, and the open questions. If the question is whether this is safe to run on a work laptop, `docs/architecture/07-enterprise.md` is written for the person who has to approve it.

## Contributing

`CONTRIBUTING.md` has the setup and the rules. The short version: keep the diff small, run `bun run typecheck && bun test`, and keep the PR description under 250 words, since `.github/pull_request_template.md` is strict on purpose.

Anything touching capture, storage, or network egress gets a closer read than the rest of the codebase. `.claude/skills/data-handling/SKILL.md` says why and lists what a reviewer will check.

## License

MIT. See `LICENSE`.
