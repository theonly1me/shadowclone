# Execution and storage boundaries

## Summary

Every boundary the project documents becomes a boundary the process enforces. Dispatch runs under the same isolation as learning and evaluation, local state is owner-only, deletion and installation act on validated targets, repository identity keeps the full namespace, and the redaction gate confines itself to consented source roots. Public documents state what the code does and nothing more.

## Problem

Several boundaries are described in `docs/architecture/` and enforced by convention. The process that runs does not enforce them.

Headless dispatch is the clearest case. Learning and evaluation pass through `isIsolatedExecution`, so they get empty setting sources, no hooks, no MCP, and an OS sandbox. Dispatch is excluded from all of it, which leaves the target repository's own configuration and the full host environment in scope for a run the user is not watching. The instruction to stay inside the worktree lives in the prompt, so the boundary is a request.

Local state is world-readable. Profiles, receipts, the index, and the installation manifest are written at the process default, so any account on the machine can read what shadowclone learned. `forget --all` and `install` both take their target directories from a mutable manifest and act on them without validating that the recorded path is still the repository it claims to be.

Repository identity keeps only the first two path components of a remote, so `gitlab.com/group/a/service` and `gitlab.com/group/b/service` resolve to one owner, and ports are dropped. Origin for a historical event is derived from whatever repository currently sits at the recorded working directory, so reusing a directory reassigns old evidence.

`resolveRedacted` is documented as the single egress gate, and two things weaken that. `parseTextRef` accepts any path and any numeric offset, so the gate reads wherever a stored pointer says. Evaluation context calls `redactSecrets` directly on instruction, skill, and memory files, which is a second materialization path the documents deny exists.

Documents claim more than the code delivers. Several publish measurements taken from one real corpus, including counts whose underlying results were another party's data. `SECURITY.md` describes release archives and attestations that no release has. Automatic promotion to `global/` after two owners is documented and not built. `forget --source` and `forget --repo` are documented and not built.

Evaluation has no total spend ceiling: a dollar limit is passed afresh to each of up to 180 invocations. Transcript ingestion and provider output both buffer without a cap.

## Prerequisites

None.

## Design

**One isolation posture.** `isIsolatedExecution` returns true for every purpose, so dispatch receives the empty setting sources, `disableAllHooks`, empty MCP config, and sandbox settings that learning and evaluation already receive. The resolved dispatch policy stays authoritative through `--allowedTools`, so a granted action keeps its qualified pattern. A dispatch run that needs `gh` carries the domains it needs and nothing else, threaded through the execution variant as `allowedDomains`.

**A curated process environment.** `runnerEnvironment` returns the keys a spawned CLI needs: the base terminal and locale set, the provider's own authentication prefix for the engine being spawned, and a GitHub token only when a remote action is granted. All three runners use it, including the two that previously inherited by default.

**Owner-only storage.** `src/storage/` owns every write under `~/.shadowclone`. `ownedWrite` creates parents at `0700`, writes a sibling temp file, chmods `0600`, and renames. `repairOwnedTree` walks an existing installation and fixes modes, reported as counts and called from `doctor` and `init`.

**Validated targets.** `resolveInstallTarget` requires an absolute path that `realpath` resolves to a git work tree root, and refuses an artifact whose own `lstat` is a symbolic link. Deletion and installation both take the validated root, and an entry that fails validation is skipped and counted.

**Managed policy the user cannot widen.** The policy file is opened once and validated through the handle, so there is no window between the check and the read. It must be a regular file owned by root with no group or write bit for anyone else, and every parent directory up to the root must satisfy the same.

**Complete repository identity.** The last path component of a remote is the repository and everything before it is the owner, so a nested namespace stays distinct. The host carries its port. The URL and SCP-style forms of one remote normalize to one identity. An origin is recorded in the index the first time a session is seen, and resolution prefers the recorded value over the current state of a working directory.

**A gate that only reads consented roots.** `parseTextRef` requires an absolute path, a non-negative integer offset, and a positive length under a fixed maximum. `resolveRedacted` checks the resolved path against the roots derived from `ProjectPaths` and returns nothing for anything outside them. Evaluation context materializes through `resolveRedacted` like every other reader.

**Receipts that hold verdicts, not content.** A run receipt keeps the task slug and a hash of the task. A transfer receipt keeps ids, fingerprints, counts, and verdicts, and drops prompts, quoted evidence, training text, compiled profile, and absolute paths. `--json` prints that reduced form.

**A spend ceiling that is a total.** The model caller tracks cumulative cost and passes the remaining budget to each invocation, so a supplied limit bounds the run. An unflagged run gets a default total, and the confirmation states it.

**Bounded reads.** Transcript ingestion reads at most a fixed window past the cursor and advances to the last complete line inside it, so the next pass continues. Provider output is streamed to a fixed maximum and the child is killed past it.

## Files

| Path | Change |
| --- | --- |
| `src/engine/execution.ts` | Isolate every purpose |
| `src/engine/claudeIsolation.ts` | Carry allowed domains for a granted action |
| `src/engine/environment.ts` | New, the curated spawn environment |
| `src/engine/readBounded.ts` | New, bounded child output |
| `src/engine/claudeCode.ts`, `src/engine/codex.ts`, `src/engine/cursorAgent.ts` | Use both |
| `src/engine/evaluationIsolation/blocked.ts` | New, the shared deny-subpath builder |
| `src/eval/transfer/sensitivePaths.ts` | New, the credential roots verification cannot read |
| `src/eval/transfer/verify.ts` | Deny those roots, keep output out of judge evidence |
| `src/eval/transfer/execute.ts` | Observe before verifying, reduce judge evidence |
| `src/eval/transfer/call.ts`, `src/eval/transfer/budget.ts` | Total spend ceiling |
| `src/eval/transfer/types.ts`, `src/eval/transfer/report.ts` | Reduced receipt |
| `src/eval/transfer/context.ts` | Materialize through `resolveRedacted` |
| `src/storage/` | New, owner-only writes and the mode repair |
| `src/cli/installTarget.ts` | New, target validation |
| `src/cli/forget.ts`, `src/cli/installArtifacts.ts` | Act on validated roots |
| `src/config/managedFile.ts` | New, policy file validation |
| `src/signal/origin/remote.ts` | Full namespace and port |
| `src/index/schema.ts`, `src/index/store.ts` | Record origin at first ingest |
| `src/observe/types.ts` | Bound a `TextRef` |
| `src/observe/cursor.ts` | Bound the ingest window |
| `src/redact/roots.ts` | New, the consented root set |
| `src/redact/index.ts` | Confine the gate to those roots |
| `src/profile/compiler/read.ts` | Reject a file that changed between reads |
| `src/dispatch/index.ts`, `src/dispatch/receipt.ts`, `src/dispatch/types.ts` | Reduced receipt |
| `src/eval/run.ts`, `src/eval/replaySession.ts`, `src/eval/engine.ts`, `src/cli/eval.ts` | Deleted |
| `docs/data-handling.md` | New, the public statement |
| `docs/architecture/*`, `docs/motivation.md`, `SECURITY.md`, `README.md` | State what the code does |

## Data handling

This change narrows what the project reads, stores, and sends. It adds no source and no network call.

Reading narrows twice. `resolveRedacted` gains a root check, so the one gate reads only under the roots a consented source names. Evaluation context stops calling `redactSecrets` directly and materializes through the gate, so there is one path from a source to a string again.

Storage narrows. Everything under `~/.shadowclone` becomes `0700` directories and `0600` files, and an existing installation is repaired on the next `doctor` or `init`.

Sending narrows. Verification output stays in the local receipt instead of reaching the judge. Run and transfer receipts drop the raw task, prompts, quoted evidence, training text, and compiled profile. `--json` prints the reduced receipt.

The redaction gate sits where it did, inside `resolveRedacted` in `src/redact/`. No new call site materializes text without it.

## Alternatives

**Leave dispatch outside isolation and rely on the prompt.** Cheapest, and it makes the strongest claim in the documents false. A worktree separates branches, not processes.

**Give evaluation a read allowlist instead of a deny list.** A stronger boundary, and it breaks real repositories, whose test scripts read caches, toolchains, and configuration from anywhere under home. Denying the credential roots keeps hostile scripts away from what matters and keeps honest ones working.

**Soften the documents and change nothing else.** Half the work, and it converts a set of fixable gaps into permanent product limits.

**Delete the whole legacy evaluation module including the scorer.** More removal than the finding needs. `scoreReplay` and the behavior extractors are the documented replay representation and carry no I/O, so they stay.

## Accepted costs

A nested-namespace remote gets a new profile directory, because its identity changes. GitHub `host/owner` identities are unchanged.

Dispatch fails on a platform without an OS sandbox instead of running unsandboxed, because `failIfUnavailable` is set.

A rebuilt index re-derives origin from the current state of a working directory. Binding at first ingest holds for the life of an index and not across a rebuild, and the index is deliberately disposable.

A dispatch run no longer sees the target repository's own hooks or settings, so a repository that relies on a hook to set up its toolchain needs that step in the task.

The stored task in a run receipt is a slug and a hash, so a receipt no longer reads back as the sentence the user typed.

## Testing

`bun run check` on Linux and macOS. Each fix carries a test proved by mutating the fix away and watching it go red.

Dispatch argv carries empty setting sources, the sandbox settings, and `disableAllHooks`, and the spawn environment holds no key outside the allowlist. Both verification sandbox profiles deny every credential root, and judge evidence holds no verification output. A written file is `0600` under a `0700` directory, and the repair fixes a loose tree. Deletion skips an installation whose directory resolves outside a work tree and never follows a symbolic link. Managed policy rejects a group-writable file, a symbolic link, and a parent that is not root-owned. Nested namespaces get distinct identities, ports distinguish hosts, and the two remote forms agree. A negative offset, an oversized length, and a path outside the roots each yield no text. A supplied dollar ceiling stops a run once spend reaches it. An oversized transcript delta advances the cursor without buffering the file.

Spawning a real CLI stays a manual step: a dispatch run in a scratch repository carrying a hook, confirming the hook does not fire and the receipt holds no raw task.

## Open questions

**Whether origin binding should survive an index rebuild.** Recording origin in the index binds it for that index's life. Making it survive a rebuild needs a store outside the disposable cache, which is a second place holding repository identity. The answer decides whether a separate provenance file is worth that.

## Decision record

Dispatch runs under the same isolation as learning and evaluation, because a worktree is a branch boundary and not a process boundary.

The spawn environment is an allowlist, because inheriting the host environment hands every credential in it to an unattended run.

Evaluation verification denies the credential roots and keeps its output out of judge evidence, because the script it runs comes from history and is not trusted.

Local state is owner-only, because a profile describes how a person works.

Deletion and installation act on a path validated as a work tree root, because the manifest that records it is mutable.

Repository identity carries the full namespace and the port, because two repositories resolving to one owner pools rules across owners.

`resolveRedacted` checks its path against the consented roots, because a gate that reads any path is a reader and not a gate.

Receipts hold verdicts and identifiers, because a receipt that holds content is a second copy of the content.

A supplied spend ceiling bounds the run and not each call, because a per-call limit multiplied by the invocation ceiling is not a limit.

Public documents drop every measurement taken from a real corpus and every capability that is not built.
