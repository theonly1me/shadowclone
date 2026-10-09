# Pull request review

## Problem

The GitHub clone works on issues and pull requests, but it cannot review one. A reviewer that sees only the diff misses the rules that a repository writes down. AI reviewers also lose trust through noise: comments that are wrong, already handled, or a matter of taste.

## Decision

`shadowclone review <pr>` reviews a pull request on this machine and writes a markdown file. `shadowclone review <pr> --cloud` asks the GitHub clone, which posts one `COMMENT` review as the clone. Both paths run the same code. Judgment lives in one bundled skill, `shadowclone-review`. Security-critical and mechanical work lives in deterministic code.

**Deterministic layer.**

1. **Collect.** It reads the PR facts, the diff from the base to the head, and the recent history of each changed file. Standards come from the base commit: `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` at the root and in each directory that the PR touches, `.claude/rules`, repository skills, `CONTRIBUTING.md`, `.github/copilot-instructions.md`, `.github/instructions`, `.cursor/rules`, `.cursorrules`, and `.shadowclone/harness.json`. A PR cannot change the rules that it is reviewed against. Personal global skills are excluded, because the owner's taste is not a rule of another repository.
2. **Built-in rules.** A table of 67 rules and nine credential patterns runs on added lines only. It covers credentials (reusing the redaction patterns), conflict markers, and dangerous calls in JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, C#, GitHub Actions, shell, Docker, Terraform, and SQL migrations. Each rule has a hit example and a miss example that a test checks. A **certain** rule (credentials, private keys, conflict markers, focused tests) is reported without the model. A **signal** rule goes to the skill for verification.
3. **Toolchain.** A table of stacks covers JavaScript and TypeScript (`typecheck` script or `tsc`, ESLint, Biome), Python (Ruff, mypy, Pyright), Go (`go vet`, `gofmt`), Rust (Clippy), Java (Maven, Gradle), and .NET. Installs run with scripts off. Type and build checks run at the head, and again at the merge base when the head has diagnostics, so only new diagnostics remain. Lint checks keep diagnostics on added lines. Each command reports ran, skipped, failed, or timed out.
4. **Dependencies.** For each lockfile that the PR changes, code parses the merge base and the head and sends only added or upgraded packages, as names and versions, to the OSV API. It reads npm, Bun, Yarn, pnpm, pip requirements, Poetry, uv, Cargo, Go modules, Bundler, Composer, and NuGet lockfiles. Each package with advisories becomes one certain finding on its lockfile line, with the worst severity and every advisory id. The check runs in the prepare stage and follows the network setting.
5. **Rank and output.** Certain rule hits and the skill's findings are sorted by severity, deduplicated, and capped at ten. Text is redacted. A posted review wraps mentions, cross-repository references, and issue links in code spans, so nobody gets a notification.

**Judgment.** One Claude run follows the skill body, which the CLI passes in the prompt because `--safe-mode` skips installed skills. The skill asks for a strict staff-level review for correctness, security, performance, reliability, compatibility, and the standards. It sends each candidate to a fresh refuter subagent, and it returns only the findings that survive, with the refuter's reason. Findings are short sentences in Simplified Technical English, and the output schema caps each field.

**Candidates.** Each signal rule hit and each new toolchain diagnostic gets an id, such as `S1` or `T1`. The model must raise each id in a finding or drop it with a reason. Code checks that each id has exactly one decision, and the report lists every dropped candidate with its reason.

**Evidence gate.** Each finding cites evidence as a source, a location, and an exact quote. After the run, code checks every quote: code quotes against the cited lines at the head, diff quotes against the diff, rule and toolchain quotes against the packet, and doc quotes against a page that code fetches itself. A finding with a code, diff, rule, or toolchain quote that does not match is dropped, with its reason. A doc quote that does not match is removed. A finding needs at least one verified quote from the code or the diff. Posted evidence links to the exact lines at the head commit.

**Correction round.** When a quote fails or a candidate has no decision, the model gets one more run with its previous answer and the list of problems. Code then judges the corrected answer, and drops what still fails. If that run fails, code judges the first answer. The result keeps the problems that started the round.

**Isolation.** The run uses a `review` execution purpose with `Read`, `Grep`, `Glob`, `Agent`, `WebSearch`, and `WebFetch`. Network access lets the reviewer read documentation instead of relying on memory. `--offline` removes the two network tools. `--restricted` confines file tools to the checkout. `--safe-mode` skips the checkout's `CLAUDE.md`, skills, hooks, and settings. MCP is off, and cloud metadata hosts are denied. The run cannot write or run commands. `WebFetch` sends only GET requests, so the run cannot upload local files. The code that checks doc quotes fetches with GET only, follows at most five redirects, and refuses private, loopback, link-local, and metadata addresses.

**Cloud jobs.** A first-line `@shadowclone review` from a requester starts a review. A requester's PR starts one when it opens or becomes ready for review. The guard routes every other tagged request to `shadowclone-work`. The worker runs five jobs, each on its own runner:

| Job                  | Credentials              | Runs PR code |
| -------------------- | ------------------------ | ------------ |
| `review-acknowledge` | App token                | No           |
| `review-prepare`     | Read-only `GITHUB_TOKEN` | No           |
| `review-checks`      | None                     | Yes          |
| `review-analyze`     | Claude token             | No           |
| `review-publish`     | App token                | No           |

The CLI runs from the runner's temporary directory, so the PR's `bunfig.toml` and package files never load. The review jobs pin `@shadowclone/cli` to the rendering version, Claude Code 2.1.286, and Bun 1.4.2. `reviewModel` in the clone configuration defaults to `claude-opus-5-5`.

**Branch review.** `shadowclone review --base <ref>` reviews the committed head of the current branch without a pull request. The base is the merge base of the head and `<ref>`. Without `--base`, the base is the merge base with `origin/HEAD`. The commit messages give the title and the description: one commit gives its subject and its body, and more commits give the latest subject and every message. The repository name comes from a GitHub `origin` remote, or it is `local/<folder>`. Evidence shows plain `path:line` locations, because the head commit may not be on GitHub. The review leaves out uncommitted changes and says so. A branch review needs no GitHub access, so an evaluation can run on cases that exist only on one machine. `--cloud` needs a pull request number.

**Setup.** `--cloud` reads the clone configuration from the installed relay workflow. Without a clone, it starts the bot wizard. With a clone that cannot review, it opens a draft update PR that renders the workflows again.

## Consequences

- The dependency check and the toolchain's base run use the merge base of the base branch and the head. The base branch tip can hold upgrades that landed after the PR branched, and a merge keeps those upgrades, so a comparison with the tip reported old versions as added. The evaluation found this on a vite PR: main moved `launch-editor` to a fixed version, and the review reported the older version as a new vulnerability.

- A review uses the owner's Claude subscription for one run, with refuter subagents inside it.
- `WebFetch` returns a summary from a small model, so a doc quote can fail the check even when the page supports the claim. The finding then keeps only its code evidence.
- A web search can find the fixed version of an old pull request. The evaluation gives every arm the same tools and records the fetched URLs.
- A local review runs the PR's toolchain on this machine with install scripts off. `--no-checks` skips it for an untrusted PR.
- Standards that exist only in local learning state are not used.
- Stack detection reads the repository root, so a monorepo without root manifests gets no toolchain checks.
- The repository's own `.github` copy changes only after a release, through the update PR, because the review jobs install the released CLI.
- PRs from forks get no cloud review.

## Data handling

A review sends the PR text, the diff, the standards, the history, rule hits, toolchain diagnostics, and the files that the agent reads to Anthropic under the owner's subscription. The dependency check sends package names and versions to the OSV API, and no code. Its web searches and the pages that it fetches go to the public web, and the skill tells it to use only public names, such as a package and a version, in them. A local result stays in `~/.shadowclone/reviews/`. A cloud result passes between jobs as a workflow artifact that expires after one day, and its findings are posted to the PR. Nothing from a review becomes learning input.

## Verification

- Tests cover these areas:
  - a dependency that the base branch upgraded after the PR branched, which the check does not count as added
  - the evidence gate for matched, moved, out-of-checkout, and doc-only quotes
  - the address table for the doc fetch
  - each rule's examples, and rule hits on added lines only
  - credential levels
  - diff ranges and head line numbers
  - standards read from the base commit
  - toolchain parsers and new-diagnostic filtering
  - ranking and the cap
  - redaction and mention neutralization
  - the review isolation arguments
  - guard routing
  - branch facts: the merge base, the commit messages, an unknown base, and a branch with no commits
  - the credentials of each rendered job
- `actionlint` accepts the rendered workflows.
- A local run on a merged PR finished in 52 seconds with a clean worktree list.
- A planted-bug fixture produced the expected finding and dropped a constant `innerHTML` signal. With the network on, its four quotes passed the evidence gate.
- A live cloud run needs a released CLI.
