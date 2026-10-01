# Related approaches

Shadowclone maintains guidance used by existing coding agents. Instruction files, skills, and memory remain part of that environment.

| Approach | Useful for | Maintenance concern |
| --- | --- | --- |
| Repository instructions | Explicit project conventions | Keeping them current and readable by the chosen agents |
| Personal skills | Reusable task workflows | Routing, ownership, supporting resources, and conflicting copies |
| Native memory | Context carried between sessions | Scope, accuracy, retention, and correction |
| Transcript analysis | Finding repeated steering and corrections | Consent and whether evidence justifies durable guidance |
| Evaluation | Checking behavior under stated guidance | Fair baselines, judge errors, and correctness |

## Shadowclone’s role

Shadowclone reads enabled sessions and memory, reconciles durable guidance, and updates relevant skills. It preserves evidence and revisions locally so a user can inspect or reverse a change. Native instructions route agents to the applicable workflows.

Using the installed agent CLI avoids separate credential setup. Requests remain subject to provider limits and send authorized inputs to that provider. The [data-handling guide](../data-handling.md) describes those boundaries.

Well-maintained instructions may already express what a user needs. The useful comparison is the effort and quality of maintaining that environment over time. Additional guidance can help, have no effect, or introduce conflict.

The [published experiments](../../evals.md) include a fixed benchmark with synthetic skills and corrections, and a separate historical study of one user's maintained skills. Both use small task sets. They do not establish results for other users, repositories, or tools.
