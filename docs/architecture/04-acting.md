# Acting

Shadowclone does not commit, push, or act on GitHub itself. Delegated work is the `shadowclone-work` skill, which runs inside the user's existing agent session and acts through that session's own tools and permissions. [Delegated work](../guides/delegated-work.md) describes its rules.

An optional Claude subagent also runs inside the user's existing agent session, uses that session's permissions, and receives the current native guidance.

Earlier versions included a task harness with private task records, owner grants for remote actions, and a headless `run` command. [Design record 029](../design/029-narrow-the-surface.md) explains the `run` removal, and [design record 030](../design/030-shadowclone-work-eval.md) the harness removal: its receipts did not change measured outcomes.

Provider transcripts remain available through their normal locations. Later learning still requires source consent and durable user guidance. Review comment text and a merge, deletion, or successful agent result alone do not establish a preference.
