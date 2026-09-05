# shadowclone

A daemon that runs on the user's own machine, watches how they work, learns their patterns, and eventually acts as them when they are away. A shadow clone, in the Naruto sense.

## Read this first

Two skills in `.claude/skills/` are not optional.

- **`clean-code`** loads before you write or edit any code, test, doc, or comment. Every task.
- **`data-handling`** loads before you touch capture, storage, or anything that makes a network call. This project reads the user's shell history, which holds their API keys and their employer's hostnames. A mistake here is a leak, not a bug.

The rest (`scoped-fix`, `review-prs`, `write-pr-description`, `write-design-doc`, `triage-review-findings`) load when the task matches their description.

## The loop

```
collect  ->  redact  ->  distill  ->  vault  ->  act
```

| Stage | File | State |
| --- | --- | --- |
| collect | `src/collector.ts` | reads `.zsh_history` and `.bash_history` |
| redact | `src/redact.ts` | the single egress gate, called by the collector |
| distill | `src/distiller.ts` | sends redacted text to a model, returns a structured skill |
| vault | `src/vault.ts` | empty stub, this is the next thing to build |
| act | none yet | nothing acts on the user's behalf |

`src/index.ts` wires collect through distill and prints the result. Say this honestly when asked what works: capture and distillation run end to end, storage and acting do not exist yet.

## The rules that outrank convenience

- **One egress gate.** `redactSecrets` in `src/redact.ts` is the only thing between captured text and the network. It is called at the collector boundary. Do not add a second one downstream as a safety net, and do not route around it.
- **Every capture source is opt-in.** Reading a new file, a wider slice of an existing file, or contents where you previously read names, is a new source. It needs a flag and a README entry in the same change.
- **Never log raw capture.** Log counts, sizes, hashes, and source names. An error message that interpolates captured text ends up in a crash reporter.
- **Acting needs per-action approval.** Observing and drafting can run unattended. Anything that sends, posts, commits, pushes, deletes, or spends asks first, every time.

`.claude/skills/data-handling/SKILL.md` has the full version and the checks to run before presenting a diff.

## Commands

```bash
bun install
bun run dev          # hot reload loop
bun run start        # one pass
bun test             # all tests
bun test src/redact.test.ts
bun run typecheck
```

`bun run typecheck && bun test` is the gate. Run both on the files you touched before presenting.

Copy `.env.example` to `.env` and add an `OPENAI_API_KEY`. Bun loads `.env` on its own.

## Bun, not Node

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of `jest` or `vitest`
- `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- `bun install` instead of `npm install`, `yarn install`, or `pnpm install`
- `bun run <script>` instead of `npm run <script>`
- Bun loads `.env` automatically, so no `dotenv`

### APIs

- `Bun.serve()` for HTTP and WebSockets. Not `express`.
- `bun:sqlite` for SQLite. Not `better-sqlite3`.
- `Bun.redis` for Redis. Not `ioredis`.
- `Bun.sql` for Postgres. Not `pg` or `postgres.js`.
- `WebSocket` is built in. Not `ws`.
- `Bun.file` over `node:fs` readFile and writeFile.
- ``Bun.$`ls` `` instead of execa.

If a UI ever gets added, use `Bun.serve()` with HTML imports, not Vite. The Bun API docs are in `node_modules/bun-types/docs/**.md`.

## Testing

```ts
import { expect, test } from "bun:test";

test("redacts an api key", () => {
  expect(redactSecrets({ text: "KEY=sk-abc" })).not.toContain("sk-abc");
});
```

A test for a capture source proves the wiring, not just the function. `src/redact.test.ts` proves the patterns work. `src/collector.test.ts` proves the collector calls them, and that is the one that catches a real regression. Prove a new test catches its bug by mutating the fix away and watching it go red, per `scoped-fix`.

## Docs

- `docs/architecture.md` holds the current shape of the system and the open questions.
- `docs/design/` holds design docs, one file per change, written against `docs/design/template.md`.
- `CONTRIBUTING.md` is for humans.

## Git

Commit messages are one line, lowercase, conventional-commit prefixed, matching what `git log --oneline` shows. Never add a co-author trailer. Never force push and never amend a commit that is already on the remote.
