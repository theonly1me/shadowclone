# Five confirmed safety and correctness fixes

## Summary

Five defects found by independent review, each verified against source before it was changed and each guarded by a regression test proven by mutation. Managed policy identified a repository by its checkout directory name. Six redaction rules kept more of a matched secret than their public prefix, three of them keeping seven characters of a secret that has no public prefix at all. Provider probes had no timeout. `learn` installed the clone into whatever repository it was run from. `requireCleanExit` could not fire.

They ship together because none of them changes behavior another depends on, and separately from the work that follows because a reader should be able to see the fixes without the redesign around them.

## Problem

**Managed policy matched a directory name.** `isOriginBlocked` built its candidates as `[origin.id, ${origin.id}/${path.basename(cwd)}]`. The origin came from the git remote and the repository name came from the directory the user cloned into, and nothing checked that the two agreed. An administrator blocking `github.com/acme/secret-api` got no protection once that repository was cloned as `secret-api-2`, and an unrelated repository cloned into a directory named `secret-api` was blocked by a pattern that was never about it. The block is consulted at five call sites covering event derivation, live clone install, the session start hook, headless dispatch, and evaluation setup, so one defect reached every path that consults managed policy. `src/profile/inject.ts` carried the same assumption in `allowedProjectFile`, whose `targetRepo` came from `path.basename(cwd)` at three callers.

**Redaction kept secret characters.** `sliced(label, keep)` preserves the first `keep` characters of a match. The rules that were tuned kept exactly their public prefix: `sk_live_` is eight characters and `stripe-key` keeps eight, `AIza` is four and `google-api-key` keeps four. Six rules kept seven regardless. For `hex-secret`, `high-entropy-string`, and `shannon-entropy` there is no public prefix, so seven characters of the secret survived, roughly 28 bits for a hex secret. For `llm-api-key` the public prefix `sk-` is three characters, so four secret characters survived. `github-token` kept three past `ghp_` and `slack-token` kept two past `xoxb-`.

**Probes could hang.** `probeCommand` spawned a child process and awaited `exited` with no timeout. `detectClaudeCode` probes `claude auth status`, `detectCodex` probes `codex login status`, and `detectCursorAgent` probes `cursor-agent status`. A probe that never returns blocks `doctor`, `learn --deep`, and `run` indefinitely with no output.

**`learn` wrote into the user's repository.** `learn` ended by testing whether the working directory was a git work tree and calling `installLiveClone` when it was, writing `.claude/agents/shadowclone.md`, `.claude/skills/shadowclone/SKILL.md`, and entries in `.git/info/exclude`. The README presents `shadowclone install` as a separate step, which implies the write is asked for.

**`requireCleanExit` could not fire.** `runHeadlessClone` calls `commitWorktree` before `inspectWorktree`, and `commitWorktree` throws on every failure path it has. On the path that reaches the guard, `git status --porcelain` is therefore always empty and `isClean` is always true, so `requireCleanExit && !inspection.isClean` is always false and the guard reduces to `run.isError`, which already throws on its own. The key was declared in `repoPolicySchema`, threaded through `resolveDispatchPolicy`, documented in an architecture example, and enforced nothing.

## Prerequisites

None.

## Design

`isOriginBlocked` accepts the repository rather than an origin and a working directory.

```ts
export function isOriginBlocked(options: {
  readonly repository: RepositoryIdentity;
  readonly patterns: readonly string[];
}): boolean
```

Its candidates become `[repository.origin.id, repository.id]`, deduplicated because an isolated repository carries its origin id as its own id. Owner-level patterns keep matching through `origin.id` and repository-level patterns now match the remote. `RepositoryIdentity` gains `name`, the bare repository segment, so `targetRepo` has a source that does not involve the filesystem. It is `null` when no remote was parsed, which `allowedProjectFile` already handles by admitting no project file.

`resolveRepository` gains the `fallbackKey` parameter `resolveCwdOrigin` already had, so an event with no working directory keys its isolated identity on `source:sessionId` as before. `resolveEventOrigins` is replaced by `resolveEventRepositories`, and `deriveSignals` blocks on the repository then derives its existing origins map from `repository.origin`, leaving `mineCorrections`, `getEventOrigin`, and `DerivedSignals.origins` unchanged. Resolving a repository reads the same single remote a resolved origin did, so this is not an extra read.

`src/signal/origin.ts` reaches 213 lines with these additions, so it becomes a folder module up front. `remote.ts` turns a remote string into an identity, `resolve.ts` turns a working directory or an event into one, and `index.ts` is the public surface. `./origin` still resolves for every existing importer.

Every `keep` value becomes the length of that rule's public prefix, and zero where there is no public prefix. `llm-api-key` keeps three, `github-token` four, `slack-token` five, and `hex-secret`, `high-entropy-string`, and `shannon-entropy` keep nothing. The three rules that were already correct are unchanged, and they are what establishes that keep is meant to be the prefix length.

`probeCommand` passes Bun's native `timeout`, which kills the child with `SIGTERM` and leaves a non-zero exit code, so a hung probe reports unavailable instead of blocking. The default is five seconds and the value is injectable so the test does not have to wait for it. Bun already defaults `stdin` to `ignore` for `spawn`, so the timeout was the only thing missing. `CommandProbe` moves to an options object because it now takes two arguments.

`learn` no longer installs anything, and its `targetDirectory` option is removed with the code that used it.

`requireCleanExit` is removed from `RepoPolicy`, `ResolvedDispatchPolicy`, `resolveDispatchPolicy`, the dispatch guard, and the architecture example. It stays in `repoPolicySchema` as an optional boolean that is parsed and discarded, because the schema is a `strictObject` and every existing config was required to contain the key.

## Files

| Path | Change |
| --- | --- |
| `src/signal/blockedOrigin.ts` | Takes `RepositoryIdentity`, matches origin id and repository id |
| `src/signal/types.ts` | `RepositoryIdentity` gains `name: string \| null` |
| `src/signal/origin.ts` | Deleted, replaced by the folder module below |
| `src/signal/origin/remote.ts` | Remote parsing, normalization, and `readGitRemote` |
| `src/signal/origin/resolve.ts` | Working directory and event resolution |
| `src/signal/origin/index.ts` | Public surface of the module |
| `src/signal/index.ts` | Blocks per event on the repository, derives the origins map from it |
| `src/cli/install.ts`, `src/cli/liveHooks.ts`, `src/mcp/server.ts` | Resolve a repository, pass `repository.name` as `targetRepo` |
| `src/dispatch/index.ts` | Passes the repository it already resolved, guard reduced to `run.isError` |
| `src/eval/transfer/setup.ts` | Resolves a repository for the block check |
| `src/redact/rules.ts` | Six `keep` values become their rule's public prefix length |
| `src/engine/detect.ts` | `probeCommand` takes options and passes a spawn timeout |
| `src/cli/learn.ts` | Drops the install call, the work tree probe, and `targetDirectory` |
| `src/config/repo.ts` | `RepoPolicy` drops `requireCleanExit`, the schema still accepts it |
| `src/dispatch/policy.ts`, `src/dispatch/types.ts` | Drop `requireCleanExit` |
| `docs/architecture/04-acting.md` | Removes `requireCleanExit` from the config example |

## Data handling

Nothing new is read and nothing new leaves the machine.

`resolveRepository` guards its remote read on `enabled && cwd.length > 0`, the guard `resolveCwdOrigin` used, and every call site passes the same `git-metadata` consent value as before. No source widens and no file is opened that was not opened already, so `resolveRedacted` is not on this path.

The redaction change moves in the protective direction only. Every affected rule now emits the same label with strictly less of the original text, so any excerpt that passed the gate before passes it with less secret material now.

Removing the `learn` install stops writing compiled profile text into repositories the user did not name. That text is derived from their own transcripts and remains under `~/.shadowclone/`, which `forget --all` removes. Repositories where a previous version already installed a clone keep their copies, and this change does not find or remove them.

One consent-dependent behavior becomes explicit rather than changing. With `git-metadata` disabled every directory resolves to an isolated origin with no repository name, so a repository-level policy pattern cannot match. That was already true and is now covered by a test.

## Alternatives

**Keep the directory name as a second candidate alongside the parsed repository.** Cheapest to start, and wrong. It preserves the false positive where an unrelated repository in a directory named `secret-api` is blocked, and a control that matches on two disagreeing notions of identity cannot be reasoned about by the administrator writing the pattern.

**Fix only the three generic redaction rules named in review.** Leaves an LLM API key with four of its secret characters intact. The three correct rules show that `keep` is meant to be the public prefix length, so applying that consistently is the fix and stopping at three is half of it.

**Keep `requireCleanExit` and give it a real meaning now.** That is a verification invariant, not a rename, and it belongs with the dispatch lifecycle rework. Leaving a key that reads as a safety control while enforcing nothing is worse than not having it.

**Deprecate `requireCleanExit` with a warning instead of discarding it.** A warning on every config read for a setting that never did anything is noise. The architecture example is updated in the same change so nothing continues to advertise it.

## Accepted costs

Repository-level policy patterns do nothing when `git-metadata` is disabled, which is the default. This is honest rather than new, and the README gains the prerequisite in the following change.

A user who set `requireCleanExit = true` loses a setting they may have believed was protecting them. It was not, and the following change states plainly that dispatch grants permission to run verification instead of enforcing it.

`resolveEventOrigins` is removed rather than deprecated. It had one caller and one re-export, both updated here.

Redaction labels for the three generic rules no longer show any of the matched shape, which costs a little readability when reading a redacted excerpt in a distillation prompt.

## Testing

`src/signal/blockedOrigin.test.ts` builds identities through `resolveRepository` with a stubbed remote reader, so it exercises the path a real block travels rather than the matcher alone. A repository whose remote is `acme/secret-api` cloned into `/work/innocent-looking-checkout` is blocked, an unrelated `acme/public-api` cloned into `/work/secret-api` is not, and a third test records that neither can match without `git-metadata` consent. Mutating `resolveRepository` to rebuild the identity from `path.basename` failed both, one open and one closed, along with the derivation test in `src/signal/policy.test.ts`.

`src/redact/retained.test.ts` asserts exact output. A secret with no public prefix redacts to the label alone, and a recognized token redacts to its vendor prefix followed by the label, with a second assertion that the retained text really is a prefix of the input. Restoring `keep: 7` produced `sk-proj...` where `sk-...` was expected, showing the four leaked characters in the failure message.

`src/engine/probe.test.ts` gives a fifty millisecond timeout to `sleep 5` and asserts the probe returns false in under two seconds. Removing the spawn timeout made the test hang until the runner killed it at five seconds and report a dangling process, which is the reported failure mode.

`src/cli/learn.install.test.ts` changes contract. It previously asserted that `learn` installs the clone into a git work tree, which is the behavior being removed, so it now runs `learn` from inside a temporary repository and asserts that neither the agent file nor the skill file exists. Restoring the install call failed it.

`src/config/index.test.ts` reads a config containing `requireCleanExit` and asserts the resulting policy holds only `allow` and `maxBudgetUsd`. Removing the optional key from the schema failed it with a parse error, which is what an existing user would have hit.

`src/signal/policy.test.ts` previously blocked `github.com/acme/one` against a remote of `acme/repo` in a directory named `one`, which passed only because of the defect. Its pattern is now the repository the remote names.

`bun run check` passes at 230 tests.

## Open questions

None.

## Decision record

`isOriginBlocked` takes a repository rather than an origin and a working directory, because a function that derives identity from two disagreeing sources cannot be made correct by its callers.

`RepositoryIdentity.name` is nullable rather than falling back to the directory name, because an absent remote means the repository is genuinely unknown and a guess reintroduces the defect.

`src/signal/origin.ts` becomes a folder module in this change rather than a later one, because the addition crosses the 200 line limit the conventions checker enforces.

Every redaction `keep` becomes its rule's public prefix length, because that is the rule the correct entries already followed and an inherited constant is what broke the rest.

`probeCommand` takes an injectable timeout rather than a fixed constant, because a five second constant makes the test that proves it a five second test.

`requireCleanExit` is discarded on read rather than removed from the schema, because `repoPolicySchema` is strict and required the key, so removing it outright would stop every existing config from parsing.
