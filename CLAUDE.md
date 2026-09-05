# shadowclone

Becomes the user. Learns how they work from the AI coding sessions they already run, then runs as them: a subagent spawned in parallel inside their own Claude Code session, and a headless clone in a worktree when they are away. A shadow clone, in the Naruto sense.

It is not a daemon. The agent CLIs already write their own transcripts to disk, so observation needs no background process. See `docs/architecture/06-roadmap.md` for why a daemon is deferred.

## Read this first

Two skills in `.claude/skills/` are not optional.

- **`clean-code`** loads before you write or edit any code, test, doc, or comment. Every task.
- **`data-handling`** loads before you touch capture, storage, or anything that makes a network call. This project reads the user's AI agent transcripts, which hold their employer's source code, hostnames, and production data, and it acts on the user's behalf. A mistake here is a leak, not a bug.

`scoped-fix` loads when you are changing existing code, which is most of the time.

## What works today

| File | Does |
| --- | --- |
| `src/config/` | stores explicit source consent, with every source off by default |
| `src/observe/` | reads enabled Claude Code, Codex, Cursor, Claude prompt, and shell sources incrementally |
| `src/redact/` | resolves pointers into redacted text, the single egress gate |
| `src/index/` | stores cursors and event skeletons in a rebuildable SQLite cache |
| `src/signal/` | derives structural and correction signals without a model |
| `src/profile/` | writes scoped markdown and compiles it into a live subagent |
| `src/engine/` | drives authenticated Claude Code, Codex, and Cursor CLIs |
| `src/distill/` | sends only redacted, allowlisted correction moments to the engine |
| `src/dispatch/` | runs the clone in a worktree and records a receipt |
| `.claude-plugin/` | injects the profile, enforces boundaries, and learns at session end |
| `src/cli/` | provides `init`, `learn`, `doctor`, `install`, `run`, and `forget --all` |

Say this honestly when asked what works: opt-in capture, indexing, the mirror, deep distillation, live profile injection, the Claude subagent, headless worktree dispatch, and three provider adapters and engines are implemented. Real plugin installation and authenticated engine runs are manual checks. API and local endpoint engines are not built yet.

## What is being built

```
observe  ->  index  ->  signal  ->  distill  ->  profile  ->  dispatch
```

| Stage | Module | Phase |
| --- | --- | --- |
| observe | `src/observe/` | 1 |
| index | `src/index/` | 1 |
| signal | `src/signal/` | 2 |
| profile | `src/profile/` | 2, subagent compiler in 3 |
| engine | `src/engine/` | 3 |
| distill | `src/distill/` | 3 |
| dispatch | `src/dispatch/` | 4 |

`docs/design/001-agent-transcript-pivot.md` is the spec, file by file. `docs/architecture/06-roadmap.md` is the order. Phases 0 through 5 are implemented. Build from the design doc.

`docs/design/002-provider-expansion.md` is the approved next change. Phase 6 adds a static capability registry and Antigravity observation, then Phase 7 adds one verified CLI provider per stacked PR.

## The rules that outrank convenience

- **One egress gate.** `redactSecrets` is the only thing between captured text and the network. It lives inside `resolveRedacted`, the only exported function that turns a `TextRef` into a string, so bypassing it takes a new file reader rather than a forgotten call. Never add a second gate downstream as a safety net, and never route around it.
- **Every capture source is opt-in.** Reading a new file, a wider slice of an existing file, or contents where you previously read names, is a new source. It needs a flag defaulting to off and a README entry in the same change. A disabled source is never opened, not even to check whether it exists.
- **Never distil tool results.** The content of any `tool_result`, file contents from Read, Edit, or Write, thinking blocks, and every data-access result never enter the distillation path. Excluded by category, not redacted. `docs/architecture/07-enterprise.md` says why.
- **Rules stay inside the organization they were learned from.** A rule carries the git remote it came from and compiles only into sessions on that organization's repos, or into `global/` once seen across two organizations. Never pool across organizations.
- **Never log raw capture.** Log counts, sizes, hashes, and source names. A transcript path names the user's employer in its slug, so log the source name and the offset instead. An error message that interpolates captured text ends up in a crash reporter.
- **Acting needs per-action approval.** Observing, deriving, and drafting run unattended. Anything that sends, posts, commits, pushes, deletes, or spends asks first, every time, gated per repo. `bypassPermissions` and `--dangerously-skip-permissions` are never passed at any tier.

`.claude/skills/data-handling/SKILL.md` has the full version and the checks to run before presenting a diff.

## Commands

```bash
bun install
bun run check        # typecheck, lint, tests
bun test             # all tests
bun test src/redact/index.test.ts
bun run typecheck
bun run lint         # biome, its as-cast plugin, and scripts/conventions.ts
bun run cli init
bun run cli learn
bun run cli doctor
bun run cli learn --deep
bun run cli run "fix the flaky test"
```

`bun run check` is the gate. Run it before presenting, and expect CI to run the same three commands on Linux and macOS.

`bun run lint` fails on `any`, a non-null `!`, an `as` cast other than `as const`, a voided or floating promise, a comment in a `.ts` file, a file over 200 lines, and an em-dash. It reports the rule and the line, so fix the code rather than the rule. A release is a `v<version>` tag matching `package.json`, and `.github/workflows/release.yml` builds and publishes it.

Nothing depends on an API key. The engine added in Phase 3 drives the user's own authenticated agent CLI.

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
- `Bun.spawn` for the agent CLIs. Not `child_process`.

If a UI ever gets added, use `Bun.serve()` with HTML imports, not Vite. The Bun API docs are in `node_modules/bun-types/docs/**.md`.

## Testing

```ts
import { expect, test } from "bun:test";

test("redacts an api key", () => {
  expect(redactSecrets({ text: "KEY=sk-abc" })).not.toContain("sk-abc");
});
```

A test for a capture source proves the wiring, not just the function. `src/redact/index.test.ts` proves the patterns work. `src/observe/index.test.ts` proves the adapter leaves captured text behind `resolveRedacted`. Every adapter under `src/observe/adapters/` ships the same shape: a fixture transcript with a planted secret, run through the real entry point, asserting the secret is absent. Prove a new test catches its bug by mutating the fix away and watching it go red, per `scoped-fix`.

Spawning a real agent CLI is a manual verification step, never a unit test. The engine is tested against recorded `stream-json` fixtures.

## Docs

- `docs/architecture/` holds the shape of the system and the reasoning behind each decision. `07-enterprise.md` is for whoever approves this at a company, `08-landscape.md` is what already exists elsewhere.
- `docs/design/001-agent-transcript-pivot.md` is the active design. It moves capture from shell history to agent session transcripts, replaces the API key with the user's own agent CLI subscription, and compiles the profile into a subagent. It is approved, Phases 0 through 5 are implemented, and the first table above describes what runs.
- `docs/design/` holds design docs, one file per change, written against `docs/design/template.md`.
- `CONTRIBUTING.md` is for humans.

## Git

Commit messages are one line, lowercase, conventional-commit prefixed, matching what `git log --oneline` shows. Never add a co-author trailer. Never force push and never amend a commit that is already on the remote. Before pushing to a branch that has a pull request, check `gh pr view --json state`. If it is merged, branch from `main` and open a new one.
