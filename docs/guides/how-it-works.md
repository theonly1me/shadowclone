# How Shadowclone works

```text
enabled sessions -> pointer index -> current consent check -> redacted evidence
                                                        -> reviewed learning
                                                        -> scoped records
scoped records -> reviewed publication -> native short rules + workflow skills
native guidance -> coding agents -> new feedback
```

1. **Read what you enable.** Shadowclone indexes references to session events without making another transcript archive. It checks current source consent after indexing and again before resolving text. Eligible instructions and bounded context are redacted before learning.
2. **Decide what is durable.** Explicit reusable guidance can qualify from one session. Inferred patterns need three independent sessions. Existing instructions, manual edits, rejected proposals, and scope constrain what can change.
3. **Review and publish.** A declined prompt stores a pending rule. Approval records it; skill publication checks scope, ownership, and destination changes. Conflicts and uncertain changes remain pending with a reason. Revisions support undo.
4. **Use it in the next session.** Short active rules appear in Claude Code and Codex native guidance. Installed skills hold detailed procedures. The session hook supplies applicable repository guidance when the global native file cannot contain it, without repeating global guidance. Optional subagents and delegated tasks remain advanced paths.

Shadowclone changes the guidance an existing model receives, not its weights. It cannot guarantee compliance.

Native instruction sections have a 4 KiB limit. Detailed workflows load when selected, and overflow remains a pending publication decision instead of silently truncating a rule.

See the [architecture](../architecture/README.md) for component boundaries and the [data-handling guide](../data-handling.md) for consent, model access, and storage.
