# Delegated work

The `shadowclone-work` skill takes a request, an issue, or an existing pull request to a pull request that is ready for review. It works inside your Claude Code or Codex session, with the tools and permissions of that agent. Shadowclone adds no commands, records, or permissions for it. The [cloud bot](cloud-bot.md) follows the same skill.

## Equip and invoke

1. Run `shadowclone wizard` and equip **Take Work to a Ready Pull Request**.
2. Review the build and apply it.
3. Start a new session in the repository.
4. Invoke the skill:

```text
/shadowclone-work Implement issue #31 and take it to a pull request that is ready to merge.
```

In Codex, use `$shadowclone-work`. Both agents also select the skill from a plain request, such as "get PR #7 ready to merge" or "address the review on my stack".

## What the skill does

1. It reads `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and the pull request template of the repository. It follows their title format, template, and checks.
2. It builds the change with tests and opens a draft pull request.
3. It loops until three things are true. Every code check passes on the current head. The branch has no conflict with its base. Every review comment has an answer. It runs a flaky job once more on the same commit. It reports a check that waits for a human.
4. It marks the pull request ready for review. Then it checks once more for comments that arrive on ready.

## Review comments

- **Fix.** If a comment names a real defect or a reasonable in-scope request, the skill fixes it. The reply is only the full 40-character SHA of the commit that changed the code. Separate several SHAs with spaces. The skill resolves a bot thread and leaves a human thread for the human.
- **Decline.** If a claim is false, asks to change documented behavior, asks for out-of-scope work, or is for another tool, the skill declines it. It posts no reply, and the thread stays open.
- **No other words.** The skill never posts words on the pull request. It never adds attribution to titles, bodies, or commits.

## Branches and stacks

Outside a stack, the skill merges the base branch in and never force pushes. In a [`gh stack`](https://gh.io/stacks) stack, it restacks with `gh stack rebase`, resolves conflicts, and pushes with `gh stack push`. It fixes a finding in the lowest pull request that owns the code.

## Limits

The skill never merges, closes, or approves a pull request. It does not change files outside the scope of the pull request.
