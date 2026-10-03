# Delegated tasks

The optional `shadowclone-work` skill coordinates work inside an existing native agent session. Its CLI and MCP operations share the task service, private checkpoints, frozen guidance, offline verification, attributed review, and explicit repository action grants. It does not replace the host's agent runtime. [Delegated work](../guides/delegated-work.md) describes task ownership, recovery, PR maintenance, and the remaining host qualification boundary.

An optional Claude subagent runs inside the user’s existing agent session and uses that session’s permissions. It receives the current native guidance.

## Policy and grants

Repository policy sets the maximum remote actions available to a task. It is not approval to perform them. Each remote action also needs a current owner grant from `shadowclone task grant`, and MCP cannot create grants.

```toml
[repo."github.com/example-team/service"]
allow = ["push", "pr-draft", "pr-reply"]
maxBudgetUsd = 2.00
```

Policy uses the full repository identity and requires `git-metadata` consent. Without it, the repository receives an isolated identity and cannot match a named remote policy. Managed policy can narrow the action tier further.

Host helpers perform granted Git and GitHub operations with validated targets and never force push. A merge also requires a shipping finish line, an open PR that GitHub reports as clean and approved, and passing checks.

Verification recipes run in a sandbox that can write only the task worktree and its temporary directory, without network access or provider credentials.

Provider transcripts remain available through their normal locations. Later learning still requires source consent and durable user guidance. A merge, deletion, or successful agent result alone does not establish a preference.

See [data handling](../data-handling.md#execution) for the provider and storage boundaries. A push sends repository Git objects without redacting their contents.
