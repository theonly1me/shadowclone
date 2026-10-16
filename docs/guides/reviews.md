# Pull request reviews

shadowclone reviews a pull request against the standards of its own repository. Code collects the facts and runs the mechanical checks, and the `shadowclone-review` skill does the judgment.

## Guided review with your agent

Equip `guided-pr-review` and `shadowclone-review`, or [install them manually](skills.md#install-skills-without-shadowclone).
Ask your coding agent: "Use guided-pr-review to review PRs 1, 2, and 3."
Give the repository or PR URLs when numbers could refer to several repositories.

The agent reads the full local repository and pins each PR's base and head.
It produces one self-contained HTML document with a shared reading route and PR filters.
The guide opens with what the change does: the problem, the result, and the approach.
For a stack, it also gives the role of each PR. You do not need to read the PR descriptions first.
The guide connects behavior across the stack while labeling each diff with its PR.
It uses `shadowclone-review` locally and keeps all findings in the document.
It reads CI results and runs a focused check only when a specific behavior needs verification.
It leaves the reviewed code unchanged.

1. Read the overview page to learn what the change does.
2. Read each step and inspect the actual diff and surrounding code.
3. Use the source links for callers and the base and head views for rendered Markdown.
4. Select prose or a code range, then choose Comment to attach your note.
5. Make mental notes or draft PR comments before revealing the agent findings.
6. Compare both reviews, then include or dismiss the agent's proposals.
7. Choose Save review in Chrome or Edge and select the original HTML.

A standalone document supports the guide and annotations without shadowclone.
Saving requires permission to edit that file. The notes stay inside the original HTML.
Keep the document outside public checkouts when it contains private code or comments.
If permission fails, the page keeps your unsaved notes and reports the failure.
Browser recovery storage does not replace saving the HTML.

### Continue in your chat

Attach the saved HTML to your existing chat and request staging.
Your agent uses your configured staging workflow and posting preferences.
It checks current code, resolves rough notes to actual changed lines, and merges duplicate concerns.
The guide contains no staging engine. Generating or opening it posts nothing to GitHub.
shadowclone does not bundle a personal staging skill.

## Review on this machine

```bash
shadowclone review 123
```

A small pull request takes about 1 minute. It writes a Markdown file to `~/.shadowclone/reviews/<owner>-<repository>/` and prints its path. `--output` chooses another file. If the file name ends in `.json`, the review is the full result as JSON, for scripts and evaluations.

You need the GitHub CLI signed in with `gh auth login` and Claude Code signed in. The review uses your Claude subscription. `--model` chooses the model (default `claude-opus-5-5`), and `--effort` sets the reasoning effort. The reviewer searches the web and fetches documentation when a claim depends on library behavior. `--offline` turns that off. It uses temporary worktrees and leaves your checkout unchanged.

## Review a branch before you open a pull request

```bash
shadowclone review --base main
```

Without a number, the review reads the commits on the current branch since it left `--base` (default `origin/HEAD`). The commit messages replace the title and description. Commit first: the review leaves out uncommitted changes and says so.

## Review in the cloud

```bash
shadowclone review 123 --cloud
```

This posts the comment `@<bot> review` with your GitHub login. Anyone with write access can also post it as the first line of a comment. Your [cloud bot](cloud-bot.md) posts one review as itself and never approves or requests changes.

A pull request gets a review only when someone tags the bot. A pull request from a fork gets a review too. For a fork, the review skips the toolchain job and turns off web search and page fetches. If the repository has no bot, `--cloud` says to run `shadowclone bot setup` first.

## What the review checks

- **Standards:** `AGENTS.md`, `CLAUDE.md`, `.claude/rules`, repository skills, `CONTRIBUTING.md`, Copilot and Cursor rules, and `.shadowclone/harness.json`, read from the base commit.
- **Built-in rules:** 67 rules and nine credential patterns on added lines. They cover credentials, conflict markers, injection, unsafe deserialization, disabled TLS checks, weak hashes, risky workflows, and infrastructure settings.
- **Dependencies:** packages that a changed lockfile adds or upgrades, checked against the OSV vulnerability database.
- **Toolchain:** the type checks, compilers, and linters of the repository for JavaScript and TypeScript, Python, Go, Rust, Java, and .NET. Only the diagnostics that the pull request adds stay. In a monorepo, each stack runs in the nearest folder that configures it.
- **Linters:** shellcheck, hadolint, actionlint, zizmor, and squawk on changed shell scripts, Dockerfiles, workflows, and SQL files. `trivy config` checks changed Terraform, Dockerfiles, and Kubernetes, Helm, and CloudFormation files. Each warning or error on a changed line is a finding.
- **Judgment:** the skill traces each change through its callers and tests. A fresh refuter subagent tries to disprove each candidate finding before you see it.

A certain rule, such as a committed credential, needs no model. A linter warning or error on a changed line is also certain. Other rule hits and toolchain diagnostics reach the review only when the skill confirms a real failure. A review reports at most 10 findings from the skill, highest severity first. It also reports every high severity finding and every certain finding, up to 25.

The review splits a change with more than 150 KB of diff into parts of up to 150 KB. At most four parts run at the same time. Each part gets its own reviewer, and every changed file reaches exactly one of them. A review in parts reports at most 10 findings for each part, and 25 in all.

## Evidence

Each finding quotes its evidence: code at the head, a line of the diff, a rule hit, a toolchain diagnostic, or a documentation passage. Code checks each quote against its source and leaves out a finding whose code quote does not match. The local review lists it as "Left out" with the reason.

Each rule hit and toolchain diagnostic that needs judgment gets an id. The reviewer must raise it in a finding or drop it with a reason, and the local review lists every dropped one. If a quote fails or an id has no decision, the reviewer gets one round of correction before code drops anything.

## Untrusted pull requests

Every toolchain command runs in an operating-system sandbox, including dependency installs, PR scripts, and executable configuration files. Linux uses Bubblewrap and needs `bubblewrap`, `socat`, `ripgrep`, and usable unprivileged user namespaces. macOS uses Seatbelt through the system `sandbox-exec` command.

Commands can read the disposable worktree and required runtimes. They can change host files only inside that worktree and isolated review state. Each review side gets a fresh HOME, temporary folder, and caches. Host credentials and private user configuration stay outside. Dependency install scripts remain disabled.

Downloads use a fixed public-registry allowlist through a restricted proxy. Package managers must support authenticated proxies. Direct networking, local services, and Unix sockets are blocked. Private registries and checks that need host credentials can fail.

If the sandbox cannot start, the check reports failure and the read-only review continues. The command never runs without isolation. `--no-checks` skips toolchain commands. The built-in rules and the skill still run. In the cloud, the toolchain job also has no secrets.

## Limits

- A stack runs in at most three project folders for each review. All checks share a budget of 10 minutes.
- The review skips a tool that you did not install. When pnpm or Yarn is missing, it runs them through Corepack. The cloud runner has the six runtimes and the five linters, but not every language linter.
- The review does not run the repository tests.
