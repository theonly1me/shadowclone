# Pull request reviews

Shadowclone reviews a pull request with the repository's own standards. Code collects the facts and runs the mechanical checks. One skill, `shadowclone-review`, does the judgment. A fresh refuter tries to disprove each candidate finding before you see it.

## Review on this machine

Run this in a checkout of the repository:

```bash
shadowclone review 123
```

The review takes about one minute for a small pull request. It writes a markdown file to `~/.shadowclone/reviews/<owner>-<repository>/` and prints its path. `--output review.md` chooses another file.

You need GitHub CLI signed in with `gh auth login` and Claude Code signed in. The review uses your Claude subscription. `--model` and `--effort` choose the model, which defaults to `claude-opus-5-5` at high effort.

The review checks out the pull request into temporary worktrees. It removes them when it finishes. Your checkout and its branch do not change.

## Review in the cloud

```bash
shadowclone review 123 --cloud
```

This posts `@shadowclone review` on the pull request. The [GitHub clone](github-clones.md) runs the same review and posts one review as the clone. It never approves and never requests changes. You can also comment `@shadowclone review` on the pull request yourself, as the first line of the comment.

A pull request that a requester opens, or marks ready for review, gets a review without a comment. Drafts, forks, outside authors, and the clone's own pull requests do not.

The first `--cloud` run sets up what is missing. Without a clone, it opens the clone setup page. With a clone that cannot review yet, it opens a draft pull request that updates the clone workflows. Merge that pull request, and then run the command again.

## What the review checks

| Layer          | What it does                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standards      | `AGENTS.md`, `CLAUDE.md`, `.claude/rules`, repository skills, `CONTRIBUTING.md`, Copilot and Cursor rules, and `.shadowclone/harness.json`, read from the base commit                                      |
| Built-in rules | 67 rules and nine credential patterns on added lines, for credentials, conflict markers, injection, unsafe deserialization, disabled TLS checks, weak hashes, risky workflows, and infrastructure settings |
| Toolchain      | The repository's own type checks, compilers, and linters for JavaScript and TypeScript, Python, Go, Rust, Java, and .NET. Only diagnostics that the pull request adds are kept                             |
| Judgment       | The `shadowclone-review` skill traces each change through its callers and tests, and a refuter subagent tries to disprove each finding                                                                     |

A certain rule, such as a committed credential, is reported without the model. Other rule hits and toolchain diagnostics reach the review only when the skill confirms a real failure. A review reports at most ten findings, highest severity first.

## Untrusted pull requests

The toolchain runs the pull request's own configuration, for example an ESLint config file, with dependency install scripts turned off. A local review runs it as you, on this machine. For a pull request from someone you do not trust, add `--no-checks`. The built-in rules and the skill still run, because they only read the code.

In the cloud, the toolchain runs in a job with no secrets. The model job holds only the Claude token and never runs the pull request's code. Only the publish job holds the App token.

## Limits

- The toolchain finds stacks from files at the repository root. A monorepo without root manifests gets no toolchain checks.
- A tool that is not installed is reported as skipped. The cloud runner has Node.js, Python, Go, Rust, Java, and .NET, but not every linter.
- The review does not run the repository's tests.
