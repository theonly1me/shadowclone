# Execution and storage boundaries

This proposal identified the isolation work completed in [remediation completion](021-remediation-completion.md).

## Problem

Provider flags alone could not guarantee that a process stayed within its intended filesystem and environment. Private derived state, repository identities, and evaluation artifacts also needed consistent handling.

## Decision

Separate learning, coding, and verification processes by purpose. Give each a controlled environment, bounded resources, and the smallest filesystem access it needs. Unsupported isolation must fail closed before execution.

Keep private state in user-owned storage with restrictive permissions. Resolve repository identities from complete remote namespaces, including meaningful ports, and use a digest to avoid collisions. Unrecognized remotes must not acquire another repository's guidance.

Read source metadata and redacted text from the same bounded snapshot. A model request or publication decision cannot use a hash from one read and content from another.

Keep raw evaluation evidence private. Public reports contain reduced scores and limitations without prompts, identifying paths, or generated private code.

## Verification

Test boundaries through real child processes using synthetic data: denied host reads, denied network access where required, termination, resource limits, and private file permissions. Platform support is conditional on those controls working. The completion record describes the implemented contracts and remaining limits.
