# Pull request reviews

Shadowclone reviews a pull request against the standards of its own repository. Code collects the facts and runs the mechanical checks. The skill `shadowclone-review` does the judgment. A fresh refuter tries to disprove each candidate finding before you see it.

## Review on this machine

Run this command in a checkout of the repository:

```bash
shadowclone review 123
```

A small pull request takes about 1 minute. The review writes a Markdown file to `~/.shadowclone/reviews/<owner>-<repository>/` and prints its path. Use `--output review.md` to choose another file.

You need the GitHub CLI signed in with `gh auth login` and Claude Code signed in. The review uses your Claude subscription. `--model` chooses the model, and the default is `claude-opus-5-5`.

`--effort` sets the reasoning effort. Without it, the review runs at the default effort of Claude Code. The reviewer searches the web and fetches documentation when a claim depends on how a library behaves. `--offline` turns that off.

The review checks out the pull request into temporary worktrees and removes them when it finishes. Your checkout and its branch do not change.

## Review a branch before you open a pull request

```bash
shadowclone review --base main
```

Without a number, the review reads the commits on the current branch since it left `--base`. Without `--base`, it uses `origin/HEAD`. The commit messages replace the title and the description of the pull request.

Commit your change first, because the review leaves out uncommitted changes and says so. A branch review needs no GitHub access. Its evidence shows plain `path:line` locations, because the commit may not be on GitHub yet.

## Review in the cloud

```bash
shadowclone review 123 --cloud
```

This command posts a comment on the pull request. Your [cloud bot](cloud-bot.md) runs the same review and posts one review as itself. The bot never approves and never requests changes.

You can also comment `@<bot> review` yourself, as the first line of a comment. The comment that `--cloud` posts is `@shadowclone review`, and only an App bot answers to that name. For a machine account bot, comment `@<bot> review` yourself.

A pull request that a requester opens, or marks ready for review, gets a review without a comment. Drafts, forks, outside authors, and pull requests of the bot itself do not.

The first `--cloud` run sets up what is missing. If you have no bot, it opens the setup page. If your bot cannot review yet, it opens a draft pull request that updates the bot workflows. Merge that pull request and run the command again.

## What the review checks

| Layer          | What it does                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standards      | `AGENTS.md`, `CLAUDE.md`, `.claude/rules`, repository skills, `CONTRIBUTING.md`, Copilot and Cursor rules, and `.shadowclone/harness.json`, read from the base commit                                      |
| Built-in rules | 67 rules and nine credential patterns on added lines, for credentials, conflict markers, injection, unsafe deserialization, disabled TLS checks, weak hashes, risky workflows, and infrastructure settings |
| Dependencies   | Added or upgraded packages in a changed lockfile, checked against the OSV vulnerability database                                                                                                           |
| Toolchain      | The type checks, compilers, and linters of the repository for JavaScript and TypeScript, Python, Go, Rust, Java, and .NET. Only the diagnostics that the pull request adds stay                            |
| Judgment       | The `shadowclone-review` skill traces each change through its callers and tests, and a refuter subagent tries to disprove each finding                                                                     |

Shadowclone reports a certain rule, such as a committed credential, without the model. Other rule hits and toolchain diagnostics reach the review only when the skill confirms a real failure. A review reports at most ten findings, highest severity first.

## Evidence

Each finding quotes its evidence. The evidence is code at the head, a line of the diff, a rule hit, a toolchain diagnostic, or a passage from a documentation page.

After the review, code checks each quote against its source. A finding whose code quote does not match is left out. The local review lists it under "Left out" with the reason. Each posted finding links to the exact lines at the reviewed commit.

Each rule hit and each toolchain diagnostic that needs judgment gets an id. The reviewer must raise it in a finding or drop it with a reason. The local review lists every dropped one with its reason. If a quote fails or an id has no decision, the reviewer gets one round of correction before code drops anything.

A finding has a title, what the change does wrong, the input that fails, the evidence, and the fix. The sentences are short and plain.

## Untrusted pull requests

The toolchain runs the configuration of the pull request, for example an ESLint config file, with dependency install scripts off. A local review runs it as you, on this machine. For a pull request from someone you do not trust, add `--no-checks`. The built-in rules and the skill still run, because they only read the code.

In the cloud, the toolchain runs in a job with no secrets. The model job holds only the Claude token or the Codex login and never runs the code of the pull request. Only the acknowledge job and the publish job hold the bot token or the App token.

## Limits

- The toolchain finds stacks from files at the repository root. A monorepo without root manifests gets no toolchain checks.
- The review skips a tool that you did not install. The cloud runner has Node.js, Python, Go, Rust, Java, and .NET, but not every linter.
- The review does not run the tests of the repository.
