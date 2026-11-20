# Delegated work

The `shadowclone-work` skill takes a request, an issue, or a pull request to a verified merge. It works in your Claude Code or Codex session, with the permissions of that agent. The [Actions bot](actions-bot.md) follows the same skill.

## Equip and invoke

1. Run `shadowclone wizard`, equip **Take Work to a Verified Merge**, and apply the build.
2. Start a new session and invoke the skill:

```text
/shadowclone-work Implement issue #31 and take it to a pull request that is ready to merge.
```

In Codex, use `$shadowclone-work`.

## What the skill does

1. It follows the format and checks in `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, the pull request template, and the repository note that your instructions name.
2. It builds the change with tests and opens a pull request that is ready for review. It adds reviewers only when you name them or the repository rule says so.
3. It loops until every code check passes on the head, the branch has no conflict, and every review thread is resolved. It reruns a flaky job once and reports a check that waits for a human.
4. For a significant change, a verifier subagent exercises the change on a running environment that the repository names. It first uses an environment that runs the branch before a pull request exists, such as a development environment that is quick to create. It uses a pull request preview only when that environment is not ready or cannot run the behavior. The evidence goes into the description.
5. It stops only for a decision that is yours, such as design or scope. It lists each decision that it made until you acknowledge it.
6. It merges only when your instructions allow agent merges and the merge gate holds. Otherwise it stops at a pull request that is ready to merge.

## Review comments

- **Fix.** If a comment names a real defect or a reasonable in-scope request, the skill fixes it. Its reply is only the full 40-character SHA of the fix. Then it resolves the thread.
- **Decline.** The skill declines a comment whose claim is false, asks to change documented behavior or for out-of-scope work, or is for another tool. It replies with one line that gives the reason, then resolves the thread.

It posts no other words and adds no attribution to titles, bodies, or commits.

## Branches and limits

Outside a stack, the skill merges the base branch in. It can rewrite pushed history when the code stays correct, and it pushes that change with `--force-with-lease`. In a [`gh stack`](https://gh.io/stacks) stack, it restacks with `gh stack rebase`, resolves conflicts, and pushes with `gh stack push`. It fixes a finding in the lowest pull request that owns the code. It builds a new stack from the start. It verifies the tip branch, which holds every lower change, and then opens the pull requests. It never approves or closes a pull request.
