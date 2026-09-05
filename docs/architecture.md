# Architecture

Declarative register, no first person, one paragraph per line, no hard wrapping. `docs/design/template.md` describes the format.

## The loop

```
collect  ->  redact  ->  distill  ->  vault  ->  act
```

Shadowclone observes the user, turns what it observed into something reusable, keeps it, and eventually uses it. Each stage is a module with one job, and the boundary between capture and everything downstream is the one that carries a security property rather than just a design preference.

## Stages

**Collect.** `src/collector.ts` reads capture sources off disk and returns text. Today the sources are `~/.zsh_history` and `~/.bash_history`, and `getRecentShellHistory` takes the last `lineCount` lines of each. `historyPaths` is injectable so tests can point it at a fixture, and `defaultHistoryPaths` is what production uses. The function has one exit, and that exit is where redaction happens.

**Redact.** `src/redact.ts` exports `redactSecrets`, which runs an ordered list of patterns over the text and replaces each match with a labelled placeholder. Order matters. Specific provider patterns run before the generic assignment pattern, so `OPENAI_API_KEY=sk-abc` comes back labelled `llm-api-key` rather than the vaguer `secret-assignment`, and the generic pattern's value class excludes `[` so it cannot redact a placeholder a second time. The gate is deliberately over-eager, because a false positive costs the distiller some context and a false negative sends a credential to a third party.

The single-gate design is the load-bearing decision in this codebase. Redaction sits at the collector boundary rather than at each network call, so there is exactly one place to audit and exactly one place a new capture source has to route through. The cost is that a future source which returns its own value without going through the collector's exit bypasses the gate silently. That cost is accepted, and `src/collector.test.ts` exists to make it loud: a new source ships a test in that shape, exercising the real entry point with a fixture secret.

**Distil.** `src/distiller.ts` sends the redacted text to a model with a `zod` schema (`SkillSchema`) and gets back a structured answer: whether a reusable practice was found, a name, a description, and a list of rules. This is the only network call in the project. It uses `generateText` from the `ai` package with `@ai-sdk/openai` and `gpt-5-nano`.

**Vault.** `src/vault.ts` is an empty stub. It will store distilled skills so they survive between runs. Nothing is persisted today, so every run starts from nothing and the daemon learns the same things repeatedly.

**Act.** Not started. No scheduler, no daemon process, no agent loop. `src/index.ts` runs the first three stages once and prints the result.

## Module boundaries

`src/index.ts` is the only file that knows about more than one stage. Each stage imports the one it directly depends on and nothing else, so `distiller.ts` does not know where its text came from and `redact.ts` does not know where its text is going. Keeping those directions one-way is what makes the gate auditable.

Files stay under 200 lines. When a stage grows past that it becomes a folder with an `index.ts` public surface, rather than a long file that gets split later.

## Data handling

Every rule that governs capture, storage, and egress lives in `.claude/skills/data-handling/SKILL.md`. The four that shape the architecture rather than just the code: sources are opt-in and enumerated, egress passes one gate, storage is local-first and readable by the user in a text editor, and acting on the user's behalf needs approval per action rather than per session.

## Open questions

Each of these is genuinely unresolved. What the answer changes is stated, because a question with no consequence is decided rather than open.

**Should the distiller be provider-agnostic?** `src/distiller.ts` imports `@ai-sdk/openai` directly and names `gpt-5-nano`. The `ai` package already abstracts providers, so swapping is a small change today and a large one after several call sites exist. The answer decides whether a local model is a supported configuration, which matters more here than in most projects, since a daemon that reads your shell history is more defensible when it can run without sending anything anywhere.

**What is the vault's schema, and is it files or a database?** Plain files can be opened in an editor by the user, which is most of the argument for keeping the vault local at all. `bun:sqlite` gives querying, which matters once the act stage needs to find the right skill for a situation. The answer decides whether deduplication is a filename property (hash the skill, let the filesystem collapse duplicates) or a query.

**What triggers the clone?** A cron-style schedule, a file watcher on the history files, an explicit invocation, or a long-running process. The answer decides whether capture is incremental (track a cursor into the history file) or always re-reads the last N lines and tolerates re-distilling the same commands.

**How does the act stage get its capabilities?** The tiering in `data-handling` says what needs approval, not how approval is requested or how a capability is described. The answer decides whether the vault stores executable skills or descriptions that something else executes.

**What is the retention window?** Nothing is stored yet, so nothing expires yet. The answer decides whether the wipe command is a directory delete or something that has to understand the schema.
