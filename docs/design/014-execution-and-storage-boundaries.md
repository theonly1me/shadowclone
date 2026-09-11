# Execution and storage boundaries

Status: superseded by [015](015-remediation-completion.md), which records the completed implementation and validation.

## Summary

This record introduced the remediation of execution permissions, local storage, source identity, and public claims. Its initial implementation supplied the foundation for the completed remediation.

## Problem

Unattended dispatch inherited ambient configuration and process environment. Generated files depended on the process umask. Installation manifests could direct deletion without ownership proof. Remote namespaces could collide, and origin bindings used only a working directory. Evaluation verification exposed credentials and forwarded its output to the judge.

## Prerequisites

Preserve the existing capture, index, signal, distillation, profile, and execution architecture. Keep release work, paid evaluations, and historical Git-identity rewriting separate.

## Design

Use curated engine environments and disable native hooks and integrations. Apply OS execution restrictions to dispatch and verification. Host helpers own granted Git/GitHub operations and their targets.

Create private generated state, validate installation targets, and preserve edited repository artifacts. Repair generated data permissions without changing executable files in worktrees.

Keep full remote namespaces and ports in repository identity. The completed design adds digest-based directory names, consent-aware session binding, and conservative handling of unknown historical provenance.

Bound source reads and process output. Compile metadata and prompt content from one snapshot. Evaluation calls share persisted accounting, and private resume state is separate from reduced reports.

## Files

The module inventory and current boundaries are maintained in [015](015-remediation-completion.md) and the [architecture overview](../architecture/README.md).

## Data handling

No capture source is added. Transcript excerpts pass through `resolveRedacted`; profile and imported context snapshots use `materializeSnapshot`. Both apply the existing pattern redactor. Neither claims to detect all confidential content.

Generated state is private to the user under normal filesystem permissions. Private evaluation state can contain selected or derived content. Reduced reports omit that content. Verification output stays out of semantic judge evidence.

## Alternatives

**Prompt-only isolation.** A worktree separates branches but does not restrict process access.

**New runtime or provenance service.** The remediation uses existing local processes and index storage.

## Accepted costs

Unsupported sandbox environments fail closed. Provider authentication remains within the user's selected runtime. Dollar budgets use cumulative reported usage and cannot promise an exact invoice limit for in-flight requests. Unknown historical origins and ambiguous legacy profile directories remain isolated.

## Testing

The completed results are recorded in [015](015-remediation-completion.md). Real authenticated provider evaluations remain deferred.

## Open questions

The completed design resolves the implementation choices in this record. Historical email rewriting and third-party notice expansion remain deferred by the maintainer.

## Decision record

2026-09-11: Retain the initial execution, storage, policy, and identity fixes; complete and validate them in one remediation PR.
