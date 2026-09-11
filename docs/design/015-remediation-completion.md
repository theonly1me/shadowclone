# Complete security and data-handling remediation

## Summary

Finish the execution and storage work in one PR, enforce bounded resource use and scoped materialization, and align public claims with the implemented behavior.

## Problem

The initial remediation still reads compiler inputs twice, gives every evaluation call the entire budget, and buffers transcripts and subprocess output without limits. Permission repair removes executable bits from checkout files. Repository directory names can collide, and cwd-only origin binding ignores current metadata consent. Public descriptions include unsupported guarantees and identifying provenance.

## Prerequisites

Preserve the existing execution-and-storage branch. The release PR, paid evaluation, and historical author-email rewrite remain deferred.

## Design

Shared bounded file and process helpers enforce named byte limits, validate file types and authorized roots, terminate process groups on failure, and keep diagnostics bounded. Private writes reject unsafe destinations and clean up temporary files. Permission repair skips checkout contents.

One persisted evaluation ledger reserves remaining allowance before every call, includes failures, and refuses continued dollar-budget execution with unknown spend. Resume state is private and versioned; shareable reports contain only metrics, verdicts, opaque identifiers, and fingerprints.

Repository identity uses the full namespace and port with a digest in disk names. Session bindings honor present consent and preserve only observed provenance. The index records its observation start; earlier unbound sessions remain isolated, and migrations preserve prior observed bindings. Profile compilation parses and redacts one bounded snapshot. Context import uses the same materialization boundary.

Unattended dispatch keeps existing action grants and isolates repository execution from host control state. Verification scripts run in a disposable snapshot with private temporary storage, no credentials or network, and bounded descendants. Host Git operations disable executable repository configuration. Snapshot extraction validates entries before writing.

Public documentation states the actual consent, storage, redaction, provider, deletion, execution, and release behavior. It does not assert that evaluations prove human equivalence or that security testing eliminates all vulnerabilities.

## Files

| Path | Change |
| --- | --- |
| `src/storage/` | Private safe writes and repair without checkout mode changes |
| `src/engine/` | Bounded execution and isolated dispatch |
| `src/eval/transfer/` | Total accounting, private resume, restricted verification, reduced reports |
| `src/observe/`, `src/redact/`, `src/profile/` | Bounded capture and authorized single-snapshot materialization |
| `src/signal/`, `src/index/` | Collision-resistant origin identity and consent-aware session binding |
| `src/cli/`, `src/dispatch/` | Owned installation artifacts and scoped host actions |
| `docs/`, `README.md`, `SECURITY.md` | Accurate capabilities and public data-handling statement |

## Data handling

No capture source is added. Authorized source excerpts and explicitly imported context pass through the materialization redaction gate before model use. Private resume state may retain redacted prompts and derived profiles and is documented accordingly. Shareable reports exclude these contents. Provider credentials stay in authenticated provider processes; verification receives none.

## Alternatives

**New runtime or daemon.** The existing process and profile architecture supports these corrections without introducing another service.

**Broader pattern matching.** This change corrects redaction claims and path authorization without changing secret-detection algorithms.

## Accepted costs

Oversized inputs are skipped or rejected with visible accounting. Unsafe or unsupported verification environments cannot run checks. Incompatible resume state cannot resume without trustworthy accounting. Provider-reported dollar limits do not constitute an exact invoice guarantee. Accepted authenticated-agent host access remains documented.

## Testing

The local full gate passed with 409 tests, including typecheck and lint. One intervening rerun timed out in the engine stderr fixture; focused tests and a subsequent full run passed without suppression or a timeout increase. Synthetic macOS integration checks ran outside the nested workspace sandbox and passed 15 assertions covering permitted workspace writes, blocked outside writes, blocked source/control/credential reads, protected Git metadata, and denied loopback networking. The captured-byte identity regression fails when its hash check is removed and passes with the check restored. A permission-repair regression and sandbox path-canonicalization regression also reproduced before correction.

The build and npm package dry run passed. The package includes the data-handling statement and security policy and excludes local plans, transcripts, and resume state. Current tracked files contain none of the identifying provenance patterns audited for this change. The approved issue and PR-body corrections were re-fetched and verified.

Linux and macOS integration tests are required in CI. The first Linux run passed 407 regular tests but could not start either sandbox probe. CI now checks namespace startup explicitly and enables unprivileged namespaces on its disposable Ubuntu runner when needed; production still fails closed when the sandbox is unavailable. See the [Ubuntu namespace restrictions](https://discourse.ubuntu.com/t/understanding-apparmor-user-namespace-restriction/58007). Paid provider evaluations and real authenticated CLI task execution remain deferred; synthetic wrapper tests do not establish provider compatibility. Process groups are terminated on cancellation and overflow; Linux additionally isolates process and IPC namespaces. These are specific controls, not a claim of complete isolation from all same-account processes.

## Open questions

None. Deferred decisions and accepted items remain listed in the local handoff plan.

## Decision record

2026-09-11: Complete all approved remediation in one PR. Keep the release PR and history rewrite separate.

2026-09-11: Protect generated state without modifying executable checkout content. Keep private resumable evidence separate from shareable metrics.

2026-09-11: Linux CI confirmed that the verifier write probe must target a host path outside its private `/tmp` mount. The fixture now exercises the read-only host mount and retains the existing write, credential, control-state, and network assertions.
