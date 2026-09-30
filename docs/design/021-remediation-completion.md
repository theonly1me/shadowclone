# Execution and storage remediation

This completes the boundaries proposed in [execution and storage boundaries](014-execution-and-storage-boundaries.md). Current behavior is summarized in [privacy architecture](../architecture/05-privacy.md).

## Process isolation

Learning runs with a controlled environment and no tool or ambient-context access. Coding agents operate within disposable repositories under the permissions for that run. Local verification executes without provider credentials, home-directory access, or network access.

OS enforcement supplements provider settings. Unsupported platforms or unavailable isolation mechanisms fail closed. Synthetic child-process probes must demonstrate denied reads and network calls; constructing the expected arguments is not enough.

Bound source reads, subprocess output, execution time, and process cleanup. Cancellation must terminate the owned process group and prevent late results from restoring a completed or failed run to an active state.

## Consistent source snapshots

Materialize source bytes once under a size limit, then derive local metadata, fingerprints, and redacted model input from that snapshot. This prevents reconciliation or compilation from pairing metadata with text that changed between reads.

Resolve repository identity from the complete remote namespace, including meaningful ports. Keep host and owner boundaries distinct and include a digest where normalization could collide. An unknown identity remains isolated. Repository preflight must reject unsafe Git entries or filesystem paths before extraction or execution.

## Private storage and reports

Store derived guidance, revisions, checkpoints, and raw evaluation receipts in user-owned private directories. Apply restrictive permissions while preserving executable bits needed by authorized artifacts. Avoid broad permission changes to unrelated files.

Raw receipts can contain repository code and personal guidance. Reduced reports exclude those contents and identifying paths. Redact model explanations and diagnostics before displaying them. A reduced metric is publishable only after reviewing its surrounding labels and context.

## Verification and limits

Use independently authored fixtures for scope collisions, changing source files, malformed profiles, unsafe archive entries, storage permissions, output caps, cancellation, and blocked host access. Run platform-specific enforcement tests on the platform they claim to support.

These controls constrain Shadowclone's processes and storage. They do not make authorized provider requests offline, guarantee perfect secret detection, or make private code safe to publish. [Data handling](../data-handling.md) describes what each operation can expose.
