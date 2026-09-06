# Privacy-Safe Action Representation for Replay Evaluation

## Problem

Evaluating whether a cloned agent accurately reproduces developer behavior requires comparing action sequences between historical sessions and simulated replay runs. Comparing full tool inputs or message payloads would risk re-exposing sensitive text, proprietary source code, or secrets.

## Privacy-Safe Fingerprints

Replay evaluation represents agent behavior using four coarse, privacy-safe dimensions:

1. **Tools**: Distinct tool names invoked during the session (such as `Read`, `Edit`, `Bash`).
2. **Verification steps**: Shell commands invoked via execution tools, normalized to their first two tokens (for example `bun test` or `git diff`). Arguments, flags, and targets beyond the verb and subcommand are omitted.
3. **Files touched**: Posix repository-relative paths extracted exclusively from designated file path parameters in editing tools (`Edit`, `Write`, `NotebookEdit`). Absolute paths, file contents, and edit diffs are never stored or compared.
4. **Planning sequence**: A binary indicator of whether planning activity (such as plan mode or task lists) preceded the first code modification.

## Ground-Truth Index Storage

In version 1, local indexed events store only tool names and metadata without file paths. As a result, ground-truth comparison against the index evaluates tools, verification, and planning, treating the file path dimension as unavailable rather than synthesising artificial data.
