# Importing repository guidance

The original importer produced profile rules. [Skills delivery](023-skills-as-delivery.md) retains imported guidance as evidence and avoids republishing instructions already supplied by the repository.

## Problem

Users had already written useful instructions in native agent files. Ignoring those files could produce duplicate or contradictory learned guidance.

## Decision

Add a separate, default-off `declared-rules` source. Read only supported root instruction files and directly supported skill locations. Do not recursively search the repository or follow symbolic links. Bound a read to 256 files and 2 MiB.

Resolve text through the learning redaction boundary. Preserve exact repository scope and derive stable identities from the source path and heading so repeated imports update the same records. Git metadata still requires separate consent; importing instructions does not authorize remote discovery.

Imported instructions have user-owned authority. Preserve manual edits, source removals, and rejected records. Disagreement from mined evidence becomes a proposal and cannot silently replace an explicit instruction.

## Tradeoffs and verification

A closed path set misses unconventional instruction locations but makes consent predictable. Adding a location widens the source and needs a documented decision.

Use fixtures for supported paths, symlinks, limits, redaction, repeated imports, moved or deleted sections, manual edits, and scope isolation. Current source locations are listed in [data handling](../data-handling.md).
