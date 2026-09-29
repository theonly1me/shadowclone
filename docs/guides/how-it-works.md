# How Shadowclone works

```text
enabled sessions and memory -> redacted learning -> local evidence records
                                                  -> maintain or create skills
skills + small native instructions -> coding agents -> new feedback
```

1. **Read what you enable.** Shadowclone indexes references to session events without making another transcript archive. It selects eligible instructions and corrections with supporting context, then redacts the text before learning.
2. **Decide what is durable.** Explicit reusable guidance can qualify from one session. Inferred patterns need three independent sessions. Existing instructions, manual edits, rejected proposals, and scope constrain what can change.
3. **Improve the right workflow.** Learning updates a matching skill or creates a missing one. Supported edits follow your write permissions; conflicts and uncertain changes stay pending. Evidence survives even when publication cannot finish.
4. **Use it in the next session.** A small baseline skill carries shared preferences. Task skills hold detailed procedures, and native agent instructions explain which skills to read. Hooks, MCP, optional subagents, and delegated runs use the same delivery path.

Shadowclone changes the guidance an existing model receives, not its weights. It cannot guarantee compliance.

The baseline and native instruction sections each have a 4 KiB limit. Detailed workflows load when selected, and evidence and history remain available when guidance exceeds a delivery limit.

See the [architecture](../architecture/README.md) for component boundaries and the [data-handling guide](../data-handling.md) for consent, model access, and storage.
