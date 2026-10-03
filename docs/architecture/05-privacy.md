# Privacy boundaries

The [data-handling guide](../data-handling.md) owns the source inventory, local file locations, and removal instructions. This page explains the implementation boundaries a contributor must preserve.

## Source access

Every capture source has a separate setting that defaults off. Managed policy can restrict consent. Pre-consent discovery can answer whether a configured root exists and has content, but cannot open its entries or retain identifying metadata.

Repository identity discovery, memory, agent context, skills, and repository manifests have separate settings. Permission to read one source does not expand another source or grant skill-write authorization.

## Learning text

The event index stores pointers and event metadata. `resolveRedacted` materializes an eligible reference only after validating its range, root, file type, limits, and captured identity. `materializeSnapshot` uses the same redaction boundary for bounded file snapshots and keeps model text consistent with parsed metadata.

Tool-result payloads, tool-returned file contents, thinking blocks, and data-access results are excluded from learning by category. The parser may encounter their bytes while reading an enabled transcript. Redaction applies to eligible text and cannot guarantee that every sensitive detail is removed.

Persistent identities stay local behind opaque prompt tokens during reconciliation. Logs use counts, sizes, hashes, and source names. Captured paths and raw provider output must not become diagnostic text.

## Scope and publication

Project guidance requires a registered repository and matching identity. Organization guidance remains within its remote owner; explicit global guidance is shared by design. Unknown or ambiguous origins remain isolated.

Reading a skill does not authorize changing it. Supported user-skill edits require maintenance authorization, use fingerprints, and form reversible revisions with their native instructions and evidence. Divergent edits remain pending. Third-party packages and native memory remain untouched.

Resource copies preserve their bytes and permissions. They are checked locally and are not sent to the learning model or executed during maintenance. Symlinks, unsafe references, and exceeded publication limits stop the update.

Shared repository files require review because they can publish personal guidance to teammates. Repository setup asks separately before including global personal preferences. Browser previews validate observed files again before applying a change.

## Model execution

Learning uses a no-tools engine request with shared limits. Authorized coding runs expose a worktree to the selected provider. Evaluation exposes synthetic task workspaces and the tested setup's guidance, and judges receive generated code without redaction to preserve its meaning. These are distinct input contracts.

Pi learning supplies prepared messages and an empty tool set through its model registry. A private socket with a per-session token connects a worker to a live Pi extension; standalone requests use owner-only temporary files and the installed Pi CLI. Neither path supplies the coding conversation or its system prompt. Provider credentials remain available to Pi's configured providers and extensions, outside the learning input. Pi dispatch and evaluation remain disabled because their action restrictions are unqualified.

Candidate writes and verification have separate operating-system restrictions. Verification receives no provider credentials or network access. Unknown spend or unavailable required isolation stops the affected workflow.

The browser server binds to loopback, serves bundled assets, validates origins, and authenticates requests with an ephemeral token. Opening it does not enable capture. Optional model descriptions preview their input and destination and never become agent instructions.

## Local recovery

Private state, revisions, snapshots, and receipts may contain sensitive derived content even though whole transcripts are not copied. Owner-only permissions do not protect against every process or administrator with equivalent access, and state is not encrypted.

Cleanup uses installation ownership and fingerprints. It preserves unrelated files and refuses conflicting edits. Deleting local state cannot remove provider requests, original transcripts, remote Git history, or backups. See [retention and removal](../data-handling.md#retention-and-removal).
