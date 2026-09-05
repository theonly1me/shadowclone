---
name: clean-code
description: Load this skill first, before writing or editing any code, test, doc, PR description, or comment, on every task. It carries the project's non-negotiable conventions for type safety, comments, naming, file size, checks, and plain prose, so it is the baseline context to gain before anything else. It composes with task-specific skills, so load it first and then add scoped-fix for fixes, data-handling for anything touching capture or egress, or review-prs for reviews. Never skip it.
---

# Clean code

The project's conventions, and the first skill to load on any code or prose task. Apply these by default whenever writing or editing code and prose, before layering on task-specific skills.

## TypeScript

- **No `any`, no non-null `!`, no `as` casts.** Only `as const` is allowed. These bypass the type system. When TypeScript pushes you toward `!` (for example `array[0]` after a length check), destructure and narrow instead with `const [first] = list; if (!first) throw Error(...);` then use `first`.
  - `noUncheckedIndexedAccess` is on, so an index read is `T | undefined` and the narrowing above is the way through it.
  - Do NOT copy an `as` from an existing or blessed file. The rule is absolute regardless of precedent.
  - Building a typed keyed object from a type-erased list (key and value uncorrelated, so `Object.fromEntries` or `reduce` cannot produce the typed record without a cast) needs a generic setter whose one type parameter re-correlates key and value.
    ```ts
    function assignFeature<Key extends keyof Features>(options: {
      snapshot: Partial<Features>;
      featureKey: Key;
      value: Features[Key];
    }): void {
      options.snapshot[options.featureKey] = options.value;
    }
    ```
- **Never `void` a promise.** For fire-and-forget, chain `.catch(noop)` or `await`. `.catch(() => {})` is an empty function, so use a shared `noop`.
- **Two or more arguments take a single options object**, never positional. One argument may be positional. This applies to internal helpers too. Call sites then read like `getRecentShellHistory({ lineCount, historyPaths })`, self-documenting and order-independent.

## Naming

- **Full words.** `statement` not `stmt`, `parameter` not `param`, `expression` not `expr`, `property` not `prop`, `index` not `i`, `child` not `n`. A loop counter that must exist gets a real name like `statementIndex`.
- Abbreviate only what the surrounding codebase already abbreviates (`url`, `id`, a namespace import like `os`, a domain term like `ctx`).
- Never shadow an import with a local name. `for (const path of paths)` under `import path from "node:path"` is a bug waiting to happen, so it is `historyPath`.

## File size

- **Keep every file under 200 lines, tests included.** When a file would grow past 200, plan a folder module up front, do not write the big file and split later.
  ```
  someThing/
    index.ts                 public export and type
    helperA.ts               one concern per file
    index.scenarioA.test.ts  tests grouped by scenario, each under 200
  ```
- `index.ts` is the only thing consumers see. Split tests by scenario cluster, not per helper.

## Checks

- **Never silence a guideline lint or type rule with a suppression.** No `eslint-disable`, no `@ts-expect-error`, no `@ts-ignore`. Restructure to comply. A suppression hides the design smell the rule points at, and complying usually reveals the correct structure. A precedent file that suppresses the same rule is not the standard to copy.
- The gates are `bun run typecheck` and `bun test`. Run both on the files you touched before presenting. `bun test <path>` runs a single file while you iterate.

## Comments

**Write zero comments. Not "few", not "only the load-bearing ones". Zero.** No `//`, no
`/** */`, no JSDoc, on functions, types, exports, tests, config or schemas. There is no
non-obvious-why exception, no hidden-invariant exception and no "this one is genuinely useful"
exception. Each of those has been argued and each got deleted.

A comment is a signal that the code failed to say something, so change the code instead:

- Rename until the name carries it. `sectionsInPrecedenceOrder` beats `sections` plus a note about ordering.
- Extract a named predicate or function. `if (isRefetchThrottled)` reads on its own where the inlined expression needed three lines above it.
- Put the state in the type. A `"loading"` union member beats `undefined` plus a comment about what `undefined` means.
- Encode the constraint as a test. A test named for the rule outlives any comment describing it.
- Put the reasoning in the PR description, which is where it actually gets read.

If none of those can carry it, ship it uncommented.

### The rule is add-none, not remove-all

It governs what your own uncommitted diff introduces. It is not licence to go deleting comments,
and there is no cleanup task hiding inside it.

- **Never commit, push, or open a PR whose purpose is removing comments.** Not existing ones, and
  not ones you wrote earlier that are already committed. Once a comment is in a commit it is part
  of the codebase, whoever typed it.
- Do NOT delete or reword comments that were already there, even long or redundant ones, unless
  asked. If one gets deleted by the author, leave it deleted.
- Landing a comment-removal commit on a branch the author has already pushed is worse than the
  comments were. It rewrites their work to satisfy a rule about yours.
- Never write a bare `TODO` or `FIXME`. Either make the change or reference a real issue number.

So the window for applying this is before you hand the work over. After that, the answer to
"these comments should not be here" is to leave them and write none in the next diff.

### Check before presenting

```bash
git diff -U0 -- <touched files> | grep -E '^\+\s*(//|/\*|\*)'
```

Expect empty. Anything it prints is a line to delete, not a line to justify. Do not run it and
then reason about which ones deserve to stay, because that judgement has been wrong every time
it has been applied.

## Prose (docs, PRs, design notes)

- Plain, human language. Short sentences, common words. It should read like a person wrote it.
- **No em-dashes anywhere**, including pseudocode comments and diagram labels. Recast with commas, parentheses, or plain "and / but / so". After writing, scan for the em-dash character and remove every one.
- Drop flourish and AI tells such as a forced "not just X but Y", rule-of-three lists, and words like leverage, robust, seamless, crucial.
- Keep the technical nouns a reviewer needs (collector, distiller, vault, redaction gate), but say them plainly.
