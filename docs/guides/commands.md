# Command reference

Run `shadowclone --help` for the full command shape. Run `shadowclone` with no arguments to see the current result and the next step.

## Set up

- `shadowclone init`: choose consent for learning and skill maintenance.
- `shadowclone init --advanced`: choose each capture source on its own.
- `shadowclone init --status --json`: check whether setup exists, with no change.
- `shadowclone init --repo`: set up shared instructions, skills, and checks for this repository.
- `shadowclone wizard`: pick skills in the browser. `--repo` opens it for this repository, `--no-open` prints the local URL, and `--cli` configures a build in the terminal.
- `shadowclone install --agent all --global`: install native guidance for every agent. `--agent <agent> --local` installs it for this repository only.
- `shadowclone uninstall --global` or `--local`: remove the integrations that shadowclone owns in that scope.
- `shadowclone sync`: refresh maintained skills, bundled skills, and native routing.
- `shadowclone doctor`: check the installation and the effective policy.
- `shadowclone forget --all`: remove all shadowclone state and the files that it owns.

Agent identifiers are `claude-code`, `codex`, `cursor`, `antigravity`, `pi`, and `opencode`. Add `--subagent` to install an optional local Claude subagent. Add `--auto-delegate` to allow automatic delegation.

## Learn

- `shadowclone learn`: index sessions and report, with no model call.
- `shadowclone learn --deep`: run a bounded learning pass with a model. Options are `--dry-run`, `--apply`, `--engine <id>`, `--model <id>`, `--reasoning-effort <level>`, and `--max-calls <n>`. See [learning](learning.md).
- `shadowclone remember [--repo or --global] <text>`: record a rule yourself.
- `shadowclone import`: read consented repository guidance as evidence.
- `shadowclone learning enable`, `disable`, or `status`: turn background learning on or off, or read the last attempt.
- `shadowclone learning list` or `pending`: list active guidance, or every open review and publication decision.
- `shadowclone learning show <key>`: read the redacted evidence, the guidance, and the scope.
- `shadowclone learning apply <key>` or `reject <key>`: decide a learned rule.
- `shadowclone learning retire <key>`, `narrow <key>`, or `replace <key> <guidance>`: preview a retirement, a limit to this repository, or a replacement.
- `shadowclone learning remove-source <source>`: preview the removal of guidance that one source alone supports.
- `shadowclone learning repositories` and `bind <id>`: review and confirm repository links for past sessions.
- `shadowclone learning acknowledge <key>`: mark later corrections as reviewed.
- `shadowclone learning probe <key> --agent <agent> --task <text> --expect <text> --yes`: test one exact response on macOS. `probe status` reads the last receipt.

## Skills, context, and history

- `shadowclone skills`: list the bundled skills. `skills list` lists the skills in your configured roots.
- `shadowclone skills update`: review the library and update skills.
- `shadowclone skills pending`: list unpublished learning and conflicts.
- `shadowclone skills show <id>`, `apply <id>`, or `reject <id>`: decide a proposal.
- `shadowclone skills configure [--repo or --global]`: choose the skill roots to maintain. It also accepts `--root <directory>` and `--third-party`.
- `shadowclone skills automatic on` or `off`: allow or stop automatic edits.
- `shadowclone skills retry <key>` or `exclude <key> <reason>`: queue a record again, or keep it unpublished.
- `shadowclone skills disable`: stop access to the skill library.
- `shadowclone context --explain`: show the guidance that is active in this repository.
- `shadowclone history [revision]`: list revisions, or show one.
- `shadowclone undo <revision>`: restore the files of a revision.

See [skill maintenance](skills.md).

## Review, cloud, and repository

- `shadowclone review <pr>`: review a pull request on this machine and write a Markdown file. `--base <ref>` reviews the commits on this branch since it left `<ref>`. `--cloud` comments `@<bot> review` so the cloud bot reviews it. Other options are `--no-checks`, `--offline`, `--repo owner/repository`, `--output file.md` (or `file.json` for the full result as JSON), `--model <id>`, and `--effort <level>`. The cloud workflow also uses `review prepare`, `checks`, `analyze`, and `publish`. See [reviews](reviews.md).
- `shadowclone bot setup --bot <login>`: set up the machine account bot. `--provider` is `anthropic` (default), `openai`, `openai-compatible`, or `cursor`. `openai-compatible` needs `--base-url <https url>` and `--model <id>`. Other options are `--model <id>`, `--repo owner/repository`, `--yes`, and `--no-open`. See the [cloud bot guide](cloud-bot.md).
- `shadowclone bot status --repo owner/repository`: list the open setup steps, or start the check run and wait up to 8 minutes for its result. It exits with status 1 until the check passes. Without `--repo`, it prints the saved setups as JSON.
- `shadowclone bot export --skill <name> --output <private-folder>`: save skills to a folder outside the checkout, with no upload.
- `shadowclone session skills`: push the equipped skills of the current checkout to your private repository `<you>/shadowclone-skills`, after you approve the file list. `--yes` skips the question.
- `shadowclone session setup --repo owner/repository`: configure cloud sessions. `--host` is `local` (default), `cloudflare`, `vercel`, `modal`, `daytona`, or `e2b`. `daytona` and `e2b` need `--receiver cloudflare`, `vercel`, `supabase` (with `--supabase-project <ref>`), or `deno` (with `--deno-org <name>`). `--provider` is `claude-subscription` (default), `anthropic`, `chatgpt-subscription`, `openai`, `openai-compatible`, `ollama`, or `foundry`. The endpoint providers need `--base-url <url>` and `--model <id>`. `--no-attribution` turns off the `Co-authored-by` trailer, `--image <name>` uses another clone image, and `--yes` approves the default branch ruleset. See [cloud sessions](cloud-sessions.md).
- `shadowclone session secrets --repo owner/repository`: add the tokens. On Cloudflare and Vercel, it runs the host's own prompt for each one. For other hosts, it names the place.
- `shadowclone session status --repo owner/repository`: run the check in Docker, or send a signed ping to a cloud receiver. It exits with status 1 until every line passes.
- `shadowclone session login --repo owner/repository`: sign in to Codex with a ChatGPT plan through a device code.
- `shadowclone session start --repo owner/repository --issue <number> [task]`: comment `/shadowclone <task>` on the issue or pull request.
- `shadowclone session list --repo owner/repository` and `shadowclone session logs`: show the sessions from their status comments, and the last log on this machine.
- `shadowclone serve`: poll GitHub and run sessions in Docker. Setup installs it as a service.
- `shadowclone check [--changed]`: run the repository checks. `--format` accepts `human`, `json`, or `claude-stop`.

## Serve

- `shadowclone mcp`: serve the [MCP tools](mcp.md) on standard input and output.

## Install notes

A repository install adds each file that it creates to `.git/info/exclude`, so the files stay out of commits. Uninstall removes those entries.

If an agent's instruction file links to a regular file in your home folder, shadowclone keeps the link and writes its block into that file. If `~/.claude/CLAUDE.md` imports the same file with `@`, Claude Code gets no second block. shadowclone follows no other link. Setup skips that agent, installs the others, and names the link and its target. `shadowclone install --agent <agent>` fails on such a link until you replace it with a regular file.

A Codex repository install writes `AGENTS.override.md`. Codex reads one instruction file in each folder, so the override would hide an existing `AGENTS.md`. In that case the install skips Codex, names both files, and exits with status 1. Other agents still install. Run `shadowclone install --agent codex --global` instead. If an earlier version created the override, the install says so and explains how to remove it.

## Non-interactive setup

An agent can pass all three consent decisions without prompts:

```bash
shadowclone init --learn --skill-maintenance --background-learning
```

Each flag has a `--no-` form. If you pass one consent flag, you must pass all three. Background learning needs session learning. An incomplete command exits and writes no configuration.
