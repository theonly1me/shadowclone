# Delegated work

The optional `shadowclone-work` skill takes a request, an issue, or an existing pull request to a pull request that is ready for review. It works inside your Claude Code or Codex session with that agent's own tools and permissions. Shadowclone adds no commands, records, or permissions of its own.

## Equip and invoke

Equip **Take Work to a Ready Pull Request** in `shadowclone wizard`, review the build, and apply it. Start a new session in the repository, then invoke the skill:

```text
/shadowclone-work Implement issue #31 and take it to a pull request that is ready to merge.
```

In Codex, use `$shadowclone-work`. Both hosts also select the skill from a plain request such as "get PR #7 ready to merge" or "address the review on my stack".

## What it does

1. Reads the repository's `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and pull request template, and follows their title format, template, and checks.
2. Builds the change with tests and opens a draft pull request.
3. Loops until every code check passes on the current head, the branch does not conflict with its base, and every review comment is handled. It reruns a flaky job once on the same commit and reports a check that waits for a human.
4. Marks the pull request ready for review, then checks once more for comments that arrive on ready.

## Review comments

- A comment that identifies a real defect or a reasonable in-scope request is fixed. The reply is only the full 40-character SHA of the commit that changed the code, several separated by spaces when needed. A bot's thread is resolved; a human's thread is left for them.
- A comment whose claim is false, that asks to change documented behavior, that asks for out-of-scope work, or that is addressed to another tool is declined: no reply, and the thread stays open.
- The skill never posts words on the pull request and never adds attribution to titles, bodies, or commits.

## Branches and stacks

Outside a stack, the skill merges the base branch in and never force pushes. In a [`gh stack`](https://gh.io/stacks) stack, it restacks with `gh stack rebase`, resolves conflicts, and pushes with `gh stack push`. It fixes a finding in the lowest pull request that owns the code.

## Limits

The skill never merges, closes, or approves a pull request. It does not change files outside the pull request's scope.
