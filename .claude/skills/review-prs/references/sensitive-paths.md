# The paths where a regression is a leak

## Why this file exists

Most of this repo is ordinary code and the usual review bias applies: a false finding is the
expensive mistake, because it costs the reviewer credibility and wastes the author's time.

On the paths below that bias inverts. They handle data the user did not choose to publish and
cannot get back. A bug in them sends someone's API key to a third party, or deletes the
behavioral history the daemon spent weeks building. A missed finding there costs more than a
false one.

So on a PR touching these paths, raise a concern you cannot fully prove and label it honestly.
"I could not rule this out, `redactSecrets` runs before this line but I could not confirm the
early return goes through it" is a useful comment here, where it would be noise elsewhere.
Stay silent only when you have verified there is nothing to say.

## The paths

```
src/collector.ts     capture. Reads the user's shell history off disk.
src/redact.ts        the egress gate. Every pattern here is load-bearing.
src/distiller.ts     the only network call. Whatever reaches it leaves the machine.
src/vault.ts         storage. A destructive write here loses learned behavior.
```

Plus any new file that reads from the user's home directory, opens a socket, calls `fetch`,
spawns a process, or writes outside the vault directory.

Load the `data-handling` skill alongside this file. It holds the rules these paths are reviewed
against, and a finding that cites one of them by name is actionable where a general worry is not.

## The checklist for a PR that touches them

Work through these in order. Each has a specific way to be wrong.

**Does capture widen?** A new file read, a new glob, a wider slice of an existing file, or
reading contents where the code previously read only names. Any of those is a new source and
needs its own opt-in flag plus a README entry in the same PR. Check `git diff` for new path
literals, not just for new functions.

**Can anything reach the network unredacted?** Trace from every new `fetch`, `generateText`, or
logging call backwards to the nearest `redactSecrets`. The gate is at the collector boundary, so
a new capture path that returns its own value without going through the collector's single exit
bypasses it. This is the single most likely real bug in this repo and it will not look like one.

**Does a log line carry raw capture?** Grep the diff for `console.log`, `console.error`, and
thrown errors that interpolate captured text. An exception message ends up in a crash reporter.

**Is a redaction pattern weakened?** A changed regex, a narrowed character class, a reordered
rule. `redactionRules` runs in order and the specific provider patterns must stay ahead of the
generic assignment pattern, otherwise a key gets the wrong label or is missed. Adding a pattern
is safe. Changing or removing one needs the PR description to say why.

**Does the test prove the wiring or only the function?** `src/redact.test.ts` proving a pattern
works says nothing about whether the collector calls it. A new source needs a test in the shape
of `src/collector.test.ts`, exercising the real entry point with a fixture secret and asserting
the secret is gone from the return value.

**Does anything act without approval?** A commit, a push, a send, a post, a delete, a payment.
Per `data-handling` these need explicit per-action approval, and a config flag the user set once
is not that.

**Is a destructive vault write guarded?** A truncate, an overwrite, a recursive delete. Confirm
there is a test, and confirm the path being deleted is computed rather than assumed.
