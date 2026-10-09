# Pull request reviews

Shadowclone reviews a pull request with the repository's own standards. Code collects the facts and runs the mechanical checks. One skill, `shadowclone-review`, does the judgment. A fresh refuter tries to disprove each candidate finding before you see it.

## Review on this machine

Run this in a checkout of the repository:

```bash
shadowclone review 123
```

The review takes about one minute for a small pull request. It writes a markdown file to `~/.shadowclone/reviews/<owner>-<repository>/` and prints its path. `--output review.md` chooses another file.

You need GitHub CLI signed in with `gh auth login` and Claude Code signed in. The review uses your Claude subscription. `--model` chooses the model, which defaults to `claude-opus-5-5`. `--effort` sets the reasoning effort; without it, the review runs at Claude Code's default. The reviewer searches the web and fetches documentation when a claim depends on how a library behaves. `--offline` turns that off.

The review checks out the pull request into temporary worktrees. It removes them when it finishes. Your checkout and its branch do not change.

## Review a branch before you open a pull request

```bash
shadowclone review --base main
```

Without a number, the review reads the commits on the current branch since it left `--base`. Without `--base`, it uses `origin/HEAD`. The commit messages take the place of the pull request title and description. Commit your change first: the review leaves out uncommitted changes, and it says so. A branch review needs no GitHub access. Its evidence shows plain `path:line` locations, because the commit may not be on GitHub.

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
| Dependencies   | Added or upgraded packages in a changed lockfile, checked against the OSV vulnerability database                                                                                                           |
| Toolchain      | The repository's own type checks, compilers, and linters for JavaScript and TypeScript, Python, Go, Rust, Java, and .NET. Only diagnostics that the pull request adds are kept                             |
| Judgment       | The `shadowclone-review` skill traces each change through its callers and tests, and a refuter subagent tries to disprove each finding                                                                     |

A certain rule, such as a committed credential, is reported without the model. Other rule hits and toolchain diagnostics reach the review only when the skill confirms a real failure. A review reports at most ten findings, highest severity first.

## Evidence

Each finding quotes its evidence: lines of code at the head, a line of the diff, a rule hit, a toolchain diagnostic, or a passage from a documentation page. After the review, code checks each quote against its source. A finding whose code quote does not match is left out, and the local review lists it under "Left out" with the reason. Each posted finding links to the exact lines at the reviewed commit.

Each rule hit and each toolchain diagnostic that needs judgment gets an id, and the reviewer must raise it in a finding or drop it with a reason. The local review lists every dropped one with its reason. If a quote fails or an id has no decision, the reviewer gets one correction round before code drops anything.

Findings use short, plain sentences: a title, what the change does wrong, the input that fails, the evidence, and the fix.

## Untrusted pull requests

The toolchain runs the pull request's own configuration, for example an ESLint config file, with dependency install scripts turned off. A local review runs it as you, on this machine. For a pull request from someone you do not trust, add `--no-checks`. The built-in rules and the skill still run, because they only read the code.

In the cloud, the toolchain runs in a job with no secrets. The model job holds only the Claude token or the Codex login and never runs the pull request's code. Only the acknowledge and publish jobs hold the bot token or the App token.

## Limits

- The toolchain finds stacks from files at the repository root. A monorepo without root manifests gets no toolchain checks.
- A tool that is not installed is reported as skipped. The cloud runner has Node.js, Python, Go, Rust, Java, and .NET, but not every linter.
- The review does not run the repository's tests.
