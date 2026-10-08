# Pull request review

## Problem

The GitHub clone works on issues and pull requests, but it cannot review one. A reviewer that sees only the diff misses the rules that a repository writes down. AI reviewers also lose trust through noise: comments that are wrong, already handled, or a matter of taste.

## Decision

`shadowclone review <pr>` reviews a pull request on this machine and writes a markdown file. `shadowclone review <pr> --cloud` asks the GitHub clone, which posts one `COMMENT` review as the clone. Both paths run the same code. Judgment lives in one bundled skill, `shadowclone-review`. Security-critical and mechanical work lives in deterministic code.

**Deterministic layer.**

1. **Collect.** It reads the PR facts, the diff from the base to the head, and the recent history of each changed file. Standards come from the base commit: `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` at the root and in each directory that the PR touches, `.claude/rules`, repository skills, `CONTRIBUTING.md`, `.github/copilot-instructions.md`, `.github/instructions`, `.cursor/rules`, `.cursorrules`, and `.shadowclone/harness.json`. A PR cannot change the rules that it is reviewed against. Personal global skills are excluded, because the owner's taste is not a rule of another repository.
2. **Built-in rules.** A table of 67 rules and nine credential patterns runs on added lines only. It covers credentials (reusing the redaction patterns), conflict markers, and dangerous calls in JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, C#, GitHub Actions, shell, Docker, Terraform, and SQL migrations. Each rule has a hit example and a miss example that a test checks. A **certain** rule (credentials, private keys, conflict markers, focused tests) is reported without the model. A **signal** rule goes to the skill for verification.
3. **Toolchain.** A table of stacks covers JavaScript and TypeScript (`typecheck` script or `tsc`, ESLint, Biome), Python (Ruff, mypy, Pyright), Go (`go vet`, `gofmt`), Rust (Clippy), Java (Maven, Gradle), and .NET. Installs run with scripts off. Type and build checks run at the head, and again at the base when the head has diagnostics, so only new diagnostics remain. Lint checks keep diagnostics on added lines. Each command reports ran, skipped, failed, or timed out.
4. **Rank and output.** Certain rule hits and the skill's findings are sorted by severity, deduplicated, and capped at ten. Text is redacted. A posted review wraps mentions, cross-repository references, and issue links in code spans, so nobody gets a notification.

**Judgment.** One Claude run follows the skill body, which the CLI passes in the prompt because `--safe-mode` skips installed skills. The run investigates the packet and the code at the head. It sends each candidate to a fresh refuter subagent, and it returns only the findings that survive, with the refuter's reason.

**Isolation.** The run uses a `review` execution purpose with `Read`, `Grep`, `Glob`, and `Agent`. `--restricted` confines file tools to the checkout. `--safe-mode` skips the checkout's `CLAUDE.md`, skills, hooks, and settings. MCP is off. The run cannot write, run commands, or use the network.

**Cloud jobs.** A first-line `@shadowclone review` from a requester starts a review. A requester's PR starts one when it opens or becomes ready for review. The guard routes every other tagged request to `shadowclone-work`. The worker runs five jobs, each on its own runner:

| Job                  | Credentials              | Runs PR code |
| -------------------- | ------------------------ | ------------ |
| `review-acknowledge` | App token                | No           |
| `review-prepare`     | Read-only `GITHUB_TOKEN` | No           |
| `review-checks`      | None                     | Yes          |
| `review-analyze`     | Claude token             | No           |
| `review-publish`     | App token                | No           |

The CLI runs from the runner's temporary directory, so the PR's `bunfig.toml` and package files never load. The review jobs pin `@shadowclone/cli` to the rendering version, Claude Code 2.1.286, and Bun 1.4.2. `reviewModel` in the clone configuration defaults to `claude-opus-5-5`.

**Setup.** `--cloud` reads the clone configuration from the installed relay workflow. Without a clone, it starts the bot wizard. With a clone that cannot review, it opens a draft update PR that renders the workflows again.

## Consequences

- A review uses the owner's Claude subscription for one run, with refuter subagents inside it.
- A local review runs the PR's toolchain on this machine with install scripts off. `--no-checks` skips it for an untrusted PR.
- Standards that exist only in local learning state are not used.
- Stack detection reads the repository root, so a monorepo without root manifests gets no toolchain checks.
- The repository's own `.github` copy changes only after a release, through the update PR, because the review jobs install the released CLI.
- PRs from forks get no cloud review.

## Data handling

A review sends the PR text, the diff, the standards, the history, rule hits, toolchain diagnostics, and the files that the agent reads to Anthropic under the owner's subscription. A local result stays in `~/.shadowclone/reviews/`. A cloud result passes between jobs as a workflow artifact that expires after one day, and its findings are posted to the PR. Nothing from a review becomes learning input.

## Verification

- Tests cover these areas:
  - each rule's examples, and rule hits on added lines only
  - credential levels
  - diff ranges and head line numbers
  - standards read from the base commit
  - toolchain parsers and new-diagnostic filtering
  - ranking and the cap
  - redaction and mention neutralization
  - the review isolation arguments
  - guard routing
  - the credentials of each rendered job
- `actionlint` accepts the rendered workflows.
- A local run on a merged PR finished in 52 seconds with a clean worktree list.
- A planted-bug fixture produced the expected finding and dropped a constant `innerHTML` signal.
- A live cloud run needs a released CLI.
