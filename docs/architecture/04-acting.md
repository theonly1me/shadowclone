# Delegated tasks

`shadowclone run "<task>"` runs an agent in a separate local worktree and records the result. The invocation authorizes one worktree, branch, and local commit for that task. Review the result before allowing any remote action.

An optional Claude subagent runs inside the user’s existing agent session and uses that session’s permissions. It receives the current native guidance. The policy below governs headless worktree runs.

## Policy and approval

Repository policy sets the maximum remote actions available. It is not approval to perform them. Each remote action also needs a matching `--approve` on that run; replies additionally identify the PR.

```toml
[repo."github.com/example-team/service"]
allow = ["push", "pr-draft", "pr-reply"]
maxBudgetUsd = 2.00
```

Policy uses the full repository identity and requires `git-metadata` consent. Without it, the repository receives an isolated identity and cannot match a named remote policy. Managed policy can narrow the action tier further.

The engine gets inspection, editing, and permitted verification tools. Host helpers perform approved Git and GitHub operations with validated targets. The agent does not receive general commit or push permissions. Permission bypass flags, force pushes, and PR merges are not granted.

## Run lifecycle

1. Resolve repository identity, managed limits, and the per-run action grants.
2. Create a separate branch and worktree. Reuse compatible installed dependencies when permitted without downloading them.
3. Prepare scoped skills and routing, or legacy guidance for an unmigrated installation.
4. Run the eligible engine under the resolved tools, permissions, and budget.
5. If a harness exists, run its gate and `shadowclone check --changed` in a verification sandbox.
6. On a failed gate, allow one repair attempt using redacted failure output and check again.
7. Commit a successful result only if the configured gate passes. A repository without a gate can produce an explicitly ungated commit.
8. Perform separately approved remote actions and leave the worktree and receipt for review.

A result that still fails its configured gate remains uncommitted. Verification can write only the worktree and its temporary directory and has no network or provider credentials.

## Receipts

A private receipt records the task, repository and branch, engine and session, available usage, changed files, commits, allowed or blocked actions, and permission denials.

The gate status is `passed`, `failed`, `not-configured`, or `not-run`. Attempts distinguish an initial pass from a repair. Inspect the receipt and worktree even when the agent reports success; an ungated run has not proved the repository’s checks pass.

Provider transcripts remain available through their normal locations. Later learning still requires source consent and durable user guidance. A merge, deletion, or successful agent result alone does not establish a preference.

See [data handling](../data-handling.md#execution) for the provider and storage boundaries. A push sends repository Git objects without redacting their contents.
