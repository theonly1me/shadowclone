# Historical replay representation

Replay compared recorded behavior with simulated actions. Current evaluation uses [fresh tasks](../architecture/09-evaluation.md); this record explains the older diagnostic.

## Decision

Compare coarse action fingerprints instead of full messages or tool inputs:

| Dimension | Representation |
| --- | --- |
| Tools | Distinct tool names |
| Verification | Shell commands reduced to their first two tokens, such as `bun test` |
| Files touched | Repository-relative paths from designated editing-tool parameters |
| Planning | Whether planning preceded the first modification |

Exclude absolute paths, file contents, diffs, and later command arguments. These reductions limit exposure but do not make the result anonymous: relative paths and command names can still reveal project details.

The version 1 index did not retain file paths. Replay therefore treated the ground-truth file dimension as unavailable, without inventing values to fill it.
