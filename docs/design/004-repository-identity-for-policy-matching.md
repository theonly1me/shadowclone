# Match managed policy against the parsed remote, not the checkout directory

## Summary

`isOriginBlocked` takes a `RepositoryIdentity` and matches managed policy patterns against the repository parsed from the git remote. It previously built its repository candidate from `path.basename(cwd)`, so a managed block on `github.com/acme/secret-api` applied only while the local checkout happened to be named `secret-api`. The same directory name assumption decided which `projects/` profile file compiled into a session, and it is removed everywhere in one change.

## Problem

`isOriginBlocked` built its match candidates as `[origin.id, ${origin.id}/${path.basename(cwd)}]`. The origin came from the git remote, the repository name came from the directory the user happened to clone into, and nothing checked that the two agreed.

An administrator who blocks `github.com/acme/secret-api` gets no protection once the repository is cloned as `secret-api-2`, `work`, or any other name. The control fails open, silently, on a cosmetic detail the administrator does not control. It also fails the other way: an unrelated repository cloned into a directory named `secret-api` is blocked by a pattern that was never about it.

The block is enforced at five call sites, covering event derivation, live clone install, the session start hook, headless dispatch, and evaluation setup, so the same defect reaches every path that consults managed policy.

`normalizeRemoteRepository` already parsed `host/owner/repository` from the remote and returned it as `RepositoryIdentity`. The correct value was available at every call site and was not used.

`src/profile/inject.ts` has the same assumption in `allowedProjectFile`, which admits a profile file at `projects/<targetRepo>.md`. Three callers passed `path.basename(cwd)` as `targetRepo`, so a renamed checkout would load a different repository's project profile, or none.

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

Its candidates become `[repository.origin.id, repository.id]`, deduplicated because an isolated repository carries its origin id as its own id. Owner-level patterns keep matching through `origin.id` and repository-level patterns now match the remote.

`RepositoryIdentity` gains `name`, the bare repository segment, so `targetRepo` has a source that does not involve the filesystem. It is `null` when no remote was parsed, which `allowedProjectFile` already handles by admitting no project file.

`resolveRepository` gains the `fallbackKey` parameter `resolveCwdOrigin` already had, so an event with no working directory keys its isolated identity on `source:sessionId` exactly as before.

`resolveEventOrigins` is replaced by `resolveEventRepositories`, returning `ReadonlyMap<string, RepositoryIdentity>`. `deriveSignals` blocks on the repository and then derives its existing origins map from `repository.origin`, so `mineCorrections`, `getEventOrigin`, and `DerivedSignals.origins` are unchanged. Resolving a repository reads the same single remote a resolved origin did, so this is not an extra read.

`src/signal/origin.ts` reaches 213 lines with these additions, so it becomes a folder module up front rather than a file split later. `remote.ts` turns a remote string into an identity, `resolve.ts` turns a working directory or an event into one, and `index.ts` is the public surface. `./origin` still resolves for every existing importer.

## Files

| Path | Change |
| --- | --- |
| `src/signal/blockedOrigin.ts` | Takes `RepositoryIdentity`, matches origin id and repository id |
| `src/signal/types.ts` | `RepositoryIdentity` gains `name: string \| null` |
| `src/signal/origin.ts` | Deleted, replaced by the folder module below |
| `src/signal/origin/remote.ts` | Remote parsing, normalization, and `readGitRemote` |
| `src/signal/origin/resolve.ts` | `resolveCwdOrigin`, `resolveRepository`, `resolveEventRepositories`, `getEventRepository`, `getEventOrigin` |
| `src/signal/origin/index.ts` | Public surface of the module |
| `src/signal/index.ts` | Blocks per event on the repository, derives the origins map from it |
| `src/cli/install.ts` | Resolves a repository, passes `repository.name` as `targetRepo` |
| `src/cli/liveHooks.ts` | Same, and drops the now unused `node:path` import |
| `src/mcp/server.ts` | Same, and drops the now unused `node:path` import |
| `src/dispatch/index.ts` | Passes the repository it already resolved |
| `src/eval/transfer/setup.ts` | Resolves a repository for the block check |

## Data handling

This change reads nothing new. `resolveRepository` guards its remote read on `enabled && cwd.length > 0`, which is the guard `resolveCwdOrigin` used, and every call site passes the same `git-metadata` consent value it passed before. No source widens, no file is opened that was not opened already, and no text reaches the network, so `resolveRedacted` is not on this path.

The change strengthens one consent-dependent behavior and makes it explicit. With `git-metadata` disabled every directory resolves to an isolated origin with no repository name, so a repository-level policy pattern cannot match. That was already true and is now covered by a test rather than left to be discovered.

## Alternatives

**Keep the directory name as a second candidate alongside the parsed repository.** Cheapest to start, and wrong. It preserves the false positive where an unrelated repository in a directory named `secret-api` is blocked, and a security control that matches on two different notions of identity cannot be reasoned about by the administrator writing the pattern.

**Resolve the repository only at the four command call sites and leave event derivation on origins.** Leaves the defect in the path that filters the largest volume of data. Events from a blocked repository would still reach signal mining whenever the checkout name differed from the remote.

## Accepted costs

Repository-level patterns do nothing when `git-metadata` is disabled, which is the default. This is honest rather than new, and the README gains the prerequisite in the following change.

`resolveEventOrigins` is removed rather than deprecated. It had one caller and one re-export, both updated here.

## Testing

`src/signal/blockedOrigin.test.ts` covers the wiring rather than the matcher alone. It builds identities through `resolveRepository` with a stubbed remote reader so the test exercises the path a real block travels.

Two tests guard the defect directly. A repository whose remote is `acme/secret-api` cloned into `/work/innocent-looking-checkout` is blocked, and an unrelated `acme/public-api` cloned into `/work/secret-api` is not. A third records that neither can match without `git-metadata` consent.

The mutation step restored the old behavior by rebuilding the identity from `path.basename(options.cwd)` inside `resolveRepository`. Both regression tests failed, one open and one closed, along with the derivation test in `src/signal/policy.test.ts`. Restoring the fix returned the suite to green at 225 tests.

`src/signal/policy.test.ts` previously blocked `github.com/acme/one` against a remote of `acme/repo` in a directory named `one`, which passed only because of the defect. Its pattern is now the repository the remote names.

## Open questions

None.

## Decision record

`isOriginBlocked` takes a repository rather than an origin and a working directory, because a function that derives identity from two disagreeing sources cannot be made correct by its callers.

`RepositoryIdentity.name` is nullable rather than falling back to the directory name, because an absent remote means the repository is genuinely unknown and a guess would reintroduce the defect.

`src/signal/origin.ts` becomes a folder module in this change rather than a later one, because the addition crosses the 200 line limit and the conventions checker enforces it.
