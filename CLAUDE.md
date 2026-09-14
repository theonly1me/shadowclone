# shadowclone

Turns engineering preferences learned from consented AI coding sessions into an editable profile, and synchronizes personal skills for the user's main Claude Code, Codex, Cursor, or Antigravity agent. Optional Claude subagents and headless worktree dispatch apply the same profile to delegated work.

There is no always-on daemon. Agent CLIs write their own transcripts; explicit commands and consented, bounded learning workers process them. See `docs/architecture/06-roadmap.md` for the implementation sequence.

## Read this first

Two skills in `.claude/skills/` are not optional.

- **`clean-code`** loads before you write or edit any code, test, doc, or comment. Every task.
- **`data-handling`** loads before you touch capture, storage, or anything that makes a network call. Captured sessions and derived guidance can contain sensitive data.

`scoped-fix` loads when you are changing existing code, which is most of the time.

## What works today

| File | Does |
| --- | --- |
| `src/config/` | stores explicit source consent, with every source off by default |
| `src/observe/` | reads enabled Claude Code, Codex, Cursor, Antigravity, Claude prompt, and shell sources incrementally |
| `src/redact/` | resolves captured-text pointers through the learning redaction gate |
| `src/index/` | stores cursors and event skeletons in a rebuildable SQLite cache |
| `src/signal/` | derives structural and correction signals without a model |
| `src/profile/` | writes scoped markdown consumed by every agent-facing projection |
| `src/profile/compiler/` | the only profile projection, deterministic and capped at 16 KiB |
| `src/integrations/` | installs stable native pointers, injects current scoped guidance, and tracks useful sessions |
| `src/engine/` | drives authenticated Claude Code, Codex, and Cursor CLIs |
| `src/distill/` | sends only redacted, allowlisted correction moments to the engine |
| `src/learning/` | runs separately consented bounded catch-up over durable user steering |
| `src/changes/` | keeps local before/after revisions and refuses conflicting undo |
| `src/skillMaintenance/` | synchronizes portable skill copies, assesses consented skills, and separates managed additions from reviewed changes |
| `src/dispatch/` | runs the clone in a worktree and records a receipt |
| `src/eval/transfer/` | compares bare, skills, and clone arms using a frozen rubric and checkpointed judge votes |
| `.claude-plugin/` | supports Claude plugin profile injection and bounded transcript ingestion |
| `src/cli/` | provides `init`, `learn`, `doctor`, `install`, `uninstall`, `run`, and `forget --all` |

Opt-in capture, indexing, the mirror, deep distillation, useful-session learning, native profile delivery, portable personal skills, optional Claude subagents, headless dispatch, and fresh transfer evaluation are implemented. Four exploratory tasks are summarized in `evals.md`; they do not validate every provider or native delivery path. Plugin installation and provider compatibility require their own live checks. Antigravity has observation and native delivery but no execution engine. API and local endpoint engines are not built.

## What is being built

```
observe  ->  index  ->  signal  ->  report
                           |
                           +->  distill  ->  profile  ->  native agents / dispatch / eval
                                                  |
                                                  +-> portable skills
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

`docs/design/001-agent-transcript-pivot.md` records the original transcript pivot. Current behavior is documented in `docs/architecture/`; `docs/architecture/06-roadmap.md` separates implemented milestones from remaining validation.

`docs/design/003-provider-expansion.md` defines provider qualification. The static capability registry and Antigravity observation are implemented; additional providers remain a backlog.

## The rules that outrank convenience

- **One profile projection.** `compileProfile` in `src/profile/compiler/` is the only thing that turns stored profile into agent-facing guidance, for installs, hooks, MCP, dispatch, and both evaluation paths. It opens a closed path set, is deterministic for identical inputs, and caps output at 16 KiB by dropping whole blocks. Never add a second projection, and never render rule text by hand at a call site.
- **One learning capture gate.** `resolveRedacted` applies `redactSecrets` when converting an eligible `TextRef` into learning text. Do not bypass it or add a redundant downstream gate. Authorized coding runs and transfer judging can send repository code to the selected provider; that separate boundary is documented in `docs/architecture/05-privacy.md`.
- **Every capture source is opt-in for its contents.** Reading a new file, a wider slice of an existing file, or contents where you previously read names, is a new source. Each source keeps its own flag, defaulting to off, and a README entry in the same change. Setup can group the consent question only after it names every detected source path. Before consent, onboarding may reduce a configured source root to one ephemeral boolean stating that it exists and is non-empty. It never collects entry names, opens an entry, or retains or logs a path, name, count, timestamp, or provider identifier.
- **Never distil tool results.** The content of any `tool_result`, file contents from Read, Edit, or Write, thinking blocks, and every data-access result never enter the distillation path. Excluded by category, not redacted. `docs/architecture/07-enterprise.md` says why.
- **Rules stay inside the remote owner they were learned from.** A rule carries the git remote it came from and compiles only into sessions under that `host/owner`. It reaches `global/` only when reconciliation marks its evidence explicit and global. Never pool across owners.
- **Never log raw capture.** Log counts, sizes, hashes, and source names. Paths and error messages must not expose captured private context.
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
bun run cli install --agent all --global
bun run cli uninstall
bun run cli run "fix the flaky test"
bun run cli eval --task "make one bounded change" --repeat 1
```

`bun run check` is the gate. Run it before presenting, and expect CI to run the same three commands on Linux and macOS.

`bun run lint` fails on `any`, a non-null `!`, an `as` cast other than `as const`, a voided or floating promise, a comment in a `.ts` file, a file over 200 lines, and an em-dash. Fix the reported code, not the rule. Release Please creates the versioned release from `main`; `.github/workflows/release.yml` checks it and publishes the npm package after environment approval. See `CONTRIBUTING.md`.

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
- `docs/design/001-agent-transcript-pivot.md` moved capture from shell history to agent session transcripts, replaced the API key with the user's own agent CLI subscription, and compiled the profile into a subagent. Phases 0 through 5 implement it.
- `docs/design/003-provider-expansion.md` records provider qualification requirements. Additional provider work follows the current roadmap.
- `docs/design/` holds design docs, one file per change, written against `docs/design/template.md` and listed chronologically in `docs/design/README.md`. Write the design record before implementation, then finalize its decisions and validation before presenting the PR.
- Every PR assesses documentation impact and updates only the documents affected by its behavior or decisions. Update the Mermaid diagram in `docs/architecture/README.md` when a stage, dependency, trust boundary, or execution path changes.
- `CONTRIBUTING.md` is for humans.

## Git

Commit messages are one line, lowercase, conventional-commit prefixed, matching what `git log --oneline` shows. Never add a co-author trailer. Never force push and never amend a commit that is already on the remote. Before pushing to a branch that has a pull request, check `gh pr view --json state`. If it is merged, branch from `main` and open a new one.
