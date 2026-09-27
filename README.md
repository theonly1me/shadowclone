<p align="center"><img src="src/web/client/assets/shadowclone-mark.svg" alt="Shadowclone logo" width="96" height="96"></p>

# Shadowclone

Your agents should share your engineering preferences, even across large repositories. Shadowclone maintains the skills, instructions, and checks that help **Claude Code, Codex, Cursor, and Antigravity** work within your guardrails.

Keep working in your usual agent. Equip workflows, add your own, and let useful corrections improve future sessions. Shadowclone learns from the sessions and memory you enable. You control what it reads, which guidance applies, and what it may change. [Why I built it](docs/motivation.md).

[Get started](#get-started) · [Agent builds](#agent-builds) · [Learning](#learn-from-your-work) · [Skills](#maintain-your-skills) · [How it works](#how-it-works) · [Privacy](#privacy-comes-first) · [Evaluations](#evaluations)

## Get started

```bash
npm install -g @shadowclone/cli
shadowclone init
```

For model-assisted learning, you need an installed and authenticated `claude`, `codex`, or `cursor-agent` CLI. Shadowclone uses that account and its quota, with no separate API key or Shadowclone account. Antigravity supports capture and native guidance; learning needs one of the other CLIs.

Setup shows the sources it found and asks what it may read, whether it may maintain your skills, and whether to learn in the background. You can decline any of these. Use `shadowclone init --advanced` to choose sources individually.

With background learning enabled, setup makes a bounded first pass through recent sessions. Open a new coding-agent session to use the installed guidance. Run `shadowclone doctor` to check the installation and `shadowclone context --explain` from your repository to see which guidance applies.

## Agent builds

Choose and equip skills like putting together a character’s kit in an RPG. Open the browser wizard:

```bash
shadowclone wizard
```

![Agent builds showing equipped skills across Craft, Verification, and Autonomy, with a build summary and skill details](docs/assets/agent-builds.jpg)

Select a skill to read its instructions and decide whether to equip it. Keep a personal build across agents, tailor a private build to a repository, or choose shared repository standards. **Review your build** shows the files that will change before you apply it. You can return and adjust your build at any time.

**Add your own skills.** Choose **Create a skill**, give it a name, explain when it applies, and write what the agent should do. **Use AI** can help draft the instructions: review the text, provider, and limits before sending, then edit the result before adding it to your build. Applying the build is a separate step.

<p align="center"><img src="docs/assets/create-skill.jpg" alt="Creating an accessible-interfaces skill with a trigger and editable instructions" width="720"></p>

Prefer the terminal? Use `shadowclone wizard --cli`. Add `--repo` to open a private repository build or `--no-open` to print the browser URL. Keep the terminal running while using the editor; Ctrl+C stops it. Opening the editor makes no model request. Its optional **Describe my agent with my model** action has its own preview.

## Learn from your work

Run a model-assisted learning pass over your enabled session history:

```bash
shadowclone learn --deep
```

Shadowclone finds reusable instructions and corrections, compares them with existing guidance, and proposes changes for your review. Accepted learning can update skills within your edit permissions. Each run is bounded; run it again if it reports more history remains.

Add **`--apply`** to accept proposed learning without the confirmation prompt. Use **`--dry-run`** to preview without applying it; this still calls the model. Deep learning requires your consent and an authenticated agent CLI. Plain `shadowclone learn` indexes and reports locally after setup. A first-time interactive run offers initialization, which can include an authorized first learning pass.

**Keep learning as you work.** Background learning has its own consent. When enabled, sessions containing reusable guidance can improve future sessions. A temporary exception or an interruption alone does not become a standing preference. Use `shadowclone learning status` to inspect it and `shadowclone learning enable` or `disable` to control it.

**Record a preference directly** with `shadowclone remember --repo "Use complete variable names."`. Use `--global` for guidance intended for every repository. Recording a preference and publishing it into skills are separate steps; `shadowclone skills pending` and `shadowclone context --explain` show what is active.

## Maintain your skills

Skills are ordinary files you can inspect and edit. Shadowclone reviews the consented library, updates a relevant workflow, or creates a skill when one is missing. Supporting files, unrelated instructions, and invocation settings are preserved.

```bash
shadowclone skills list
shadowclone skills update
shadowclone skills pending
```

Reading a library and allowing automatic edits are separate choices. Supported changes to authorized user skills can apply automatically. Third-party packages stay unchanged and receive local companion skills. Conflicts and uncertain changes remain pending for review.

Personal skills use `~/.agents/skills` as their canonical directory. Claude and Antigravity receive copies; Codex and Cursor discover that directory. Repository skills live under `.agents/skills` and `.claude/skills`. `shadowclone sync` propagates a changed maintained copy and preserves conflicting edits for review.

Every publication has a revision covering its skills, resources, native instructions, and learning decisions. Inspect or undo it with `shadowclone history`, `shadowclone history <revision>`, and `shadowclone undo <revision>`. Undo refuses to overwrite later edits. Existing profile-based installations first need [skills migration](docs/migration.md).

| Command | What it does |
| --- | --- |
| `shadowclone skills` | List bundled preferences and starter skills |
| `shadowclone skills configure --global` / `--repo` | Configure personal or repository skill roots |
| `shadowclone skills automatic on` / `off` | Allow or stop automatic edits without deleting published files |
| `shadowclone skills disable` | Stop library access |
| `shadowclone skills retry <learning-key>` | Queue a record again after resolving its conflict |
| `shadowclone skills exclude <learning-key> "This was a temporary exception."` | Record why guidance should stay unpublished |

Configuration accepts `--root <directory>` for a custom root and `--third-party` for a package you do not own. Model-assisted updates also require deep-learning consent. After retrying a record, run `shadowclone skills update`. Updates share a default budget of 20 model calls and five minutes, with a cumulative $2 ceiling on engines that support it. Later runs can continue unfinished work.

## Set up a repository

```bash
shadowclone init --repo
```

Setup asks to read project manifests, detects checks, and previews shared instructions and workflow skills. It asks separately before including personal preferences in files your teammates may see. Review and commit the files you want to share.

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Shared instructions, selected skills, and verification commands |
| `CLAUDE.md` | Import of the shared instructions |
| `.agents/skills/` and `.claude/skills/` | Repository workflows and selected personal skills |
| `.shadowclone/harness.json` | Configured checks, conventions, and file fingerprints |

Run `shadowclone check --changed` to check uncommitted work, or `shadowclone check` for the repository. A local Claude Stop hook runs these checks before the agent finishes. Other agents receive the checks through repository instructions. `shadowclone sync` refreshes the setup while preserving conflicting edits.

Use `--personal` or `--no-personal` to include or exclude applicable personal guidance. Repeat `--skill <name>` to copy selected personal skills with their resources. Use `--no-enforce` to skip the Claude Stop hook. Text outside managed sections stays yours, and edited managed sections are preserved for review. Private builds cannot weaken shared repository requirements. A skill omitted from Shadowclone’s routing may still be discovered through the host agent’s global configuration.

## How it works

```text
enabled sessions and memory -> redacted learning -> local evidence records
                                                  -> maintain or create skills
skills + small native instructions -> coding agents -> new feedback
```

1. **Read what you enable.** Shadowclone indexes references to session events without making another transcript archive. It selects user instructions and corrections, with supporting context, and redacts eligible text before learning.
2. **Decide what is durable.** Explicit reusable guidance can qualify from one session. Inferred patterns need three independent sessions. Existing instructions, manual edits, rejected proposals, and scope constrain what can change.
3. **Improve the right workflow.** Learning updates a matching skill or creates a missing one. Supported edits follow your write permissions; conflicts and uncertain changes stay pending. Evidence survives even when publication cannot finish.
4. **Use it in the next session.** A small baseline skill carries shared preferences. Task skills hold detailed procedures, and native agent instructions explain which skills to read. Hooks, MCP, optional subagents, and delegated runs use the same delivery path.

This changes the guidance an existing model receives, not its weights. It does not guarantee compliance. The baseline and native instruction sections each have a 4 KiB limit, while detailed workflows load when selected. Your evidence and history stay available even when guidance exceeds a delivery limit.

## Privacy comes first

**There is no Shadowclone collection service or telemetry.** Learning records, revisions, and original-library snapshots stay on your machine. Model work goes through your authenticated agent CLI to its provider, so it is subject to that provider’s account and retention terms. Local storage does not make learning offline.

**You choose what it reads.** Each source has its own setting and defaults off. Setup shows detected sources before asking for access; advanced setup lets you choose them individually. Reading sessions does not silently enable memory, repository metadata, or skill editing. Before consent, discovery only checks whether a configured source root exists and contains data.

| Source | What access can include |
| --- | --- |
| Agent sessions | Claude Code sessions and prompt history, Codex sessions, Cursor chats, and Antigravity logs and workspace attribution |
| Memory | Read-only Claude memory for registered repositories; selected native memory can also be frozen for evaluation |
| Instructions and skills | Native agent instructions, repository rules, and consented personal, repository, custom, or third-party skills |
| Shell history | Separately enabled `.zsh_history` and `.bash_history` |
| Git metadata | Remote names used to keep guidance scoped to its repository and owner |
| Repository setup | Known manifests, scripts, dependency names, Makefile targets, workflow files, and top-level entry names |

The [source inventory](docs/data-handling.md#sources) lists exact paths and settings. Tool-result payloads, tool-returned file contents, thinking blocks, and data-access results are excluded from learning. Enabled transcript parsers can still encounter their bytes while reading the source file.

**What leaves your machine:**

| Operation | What the selected provider can receive |
| --- | --- |
| Learning and skill maintenance | Selected redacted instructions, steering, and supporting context |
| Browser editor | Nothing merely from opening it; optional AI drafting sends reviewed form fields, and build descriptions have a separate reviewed request |
| Delegated `run` | The authorized task worktree and guidance |
| Evaluation | The chosen repository snapshot and frozen context; judges receive generated code without redaction |

Redaction catches known secret, host, path, and entropy patterns. It can miss sensitive prose or unusual secrets. Use sources and repositories you are authorized to send to the chosen provider. Native memory stays read-only, third-party packages stay unchanged, and automatic skill edits need separate permission.

### Controls for teams and enterprises

Project guidance stays with its registered repository and verified identity. Organization scope follows the remote owner; global guidance requires an explicit global instruction or decision. Unknown origins stay isolated. A remote-owner identity is a technical boundary and does not prove a legal employer boundary.

Administrators can install a root-owned managed policy to restrict sources, providers, repository origins, hosted learning, and action tiers, or disable Shadowclone. User settings cannot widen those limits. `shadowclone doctor` reports the effective policy. Policies live at `/Library/Application Support/shadowclone/managed.json` on macOS or `/etc/shadowclone/managed.json` on Linux. See the [policy example](docs/architecture/07-enterprise.md#managed-policy).

The browser editor binds only to loopback, serves local assets, checks request origins, and authenticates its API with an ephemeral token. Learning requests have no tools and use shared call, time, and supported spending limits. Delegated work uses an isolated worktree; local verification has no network or provider credentials. Required isolation must be available before the affected workflow runs.

`shadowclone run <task>` authorizes one local worktree, branch, and commit. Remote actions also need a repository policy ceiling and approval for that run. Shared repository instructions require review before personal guidance is included. [Execution controls](docs/architecture/04-acting.md) describe the boundaries in detail.

**Storage and removal.** State lives under `~/.shadowclone/`, with published skills and instructions in the selected agent or repository directories. Whole transcripts are not copied, but derived records and evaluation evidence can contain sensitive content. Local state is not encrypted; processes with equivalent access and backups may read it. Managed policy governs Shadowclone, not other programs under the account. There is no automatic expiry policy or local model runner.

Disable background learning with `shadowclone learning disable`, stop automatic skill edits with `shadowclone skills automatic off`, or remove recorded state with `shadowclone forget --all`. Preserve unfinished worktrees first. Conflicting managed edits can block removal. Original transcripts, native memory, provider-retained requests, backups, and remote Git history remain. Repository setup files remain too; use `undo` before deleting revision history or remove them through version control. [Data handling](docs/data-handling.md) and [security reporting](SECURITY.md) cover the full details.

## Evaluations

We measure whether guidance changes an agent’s behavior on the same tasks, keeping preference adherence, correctness, and safety separate. The results below come from the earlier profile-based system. Current skills evaluations compare **Bare**, **original Skills**, **original Skills + Memory**, and **maintained Skills + native routing**, preserving the original library as a baseline.

**Early preference comparison.** GPT-5.6 Sol at medium reasoning effort completed four TypeScript tasks, once per setup. Each implementation was judged against the same 17 preference checks, with three model votes per check. Bare received repository guidance; Skills added existing personal skills and context; Clone added the Shadowclone profile.

| Task | Bare | Skills | Clone |
| --- | ---: | ---: | ---: |
| Byte quantities | 11/17 | 14/17 | 15/17 |
| Integer ranges | 15/17 | 14/17 | 16/17 |
| Ordered query parameters | 15/17 | 16/17 | 16/17 |
| Bounded undo/redo | 14/17 | 15/17 | 15/17 |
| Total | 55/68 (80.9%) | 59/68 (86.8%) | 62/68 (91.2%) |

Clone exceeded Skills on two tasks and tied on two, an aggregate difference of 4.4 percentage points. These are guideline checks, not correctness or productivity scores. Candidate tests were not executed. The sample was small, the personal skills were not optimized for the comparison, and judges made documented mistakes around assertions and test setup. The recorded scores have not been silently corrected.

Later guidance-and-memory comparisons were mixed. After one explicitly directed reference correction, Shadowclone scored 9/10 on preferences and 8/8 on shared-memory checks; native memory scored 10/10 and 6/8. Shadowclone still used a prohibited cast and changed files outside the task. The conditions had different reference content, and runtime correctness remained unverified. These results do not establish autonomous repair or general superiority. [Later comparison details](docs/design/021-guidance-evaluation.md#recorded-comparisons).

**Repository setup pilot.** Claude Code ran the same task with and without repository setup on two synthetic projects. Both arms passed held-out acceptance checks and the project gate, and neither committed. On the Python project, the baseline skipped a test while the configured agent added one. This was one run per arm per project, so it demonstrates a working practice in that sample, not a general improvement.

Read [the full methods, task specifications, scores, and known judging issues](evals.md). The [evaluation guide](docs/architecture/09-evaluation.md) explains running your own comparison, isolation, explicit spending limits, and recovery. Successful migration or skill publication alone is not evidence of improved behavior.

## Built with agents

I built Shadowclone without writing code by hand. Agents wrote the implementation; I set the requirements, engineering preferences, and guardrails. To me, that is still engineering. This repository has more than 800 source and test files. Ask your agent to review its architecture, code quality, and tests, then judge the result for yourself. [Why I built it and what it solves](docs/motivation.md).

<details><summary>More commands</summary>

| Command | Purpose |
| --- | --- |
| `shadowclone import` | Refresh consented repository guidance as evidence |
| `shadowclone recall <query>` | Search available scoped references |
| `shadowclone install --agent all --global` | Install native guidance manually |
| `shadowclone install --agent <agent> --local` | Install guidance for this repository without shared setup |
| `shadowclone uninstall --global` / `--local` | Remove owned integrations in the selected scope |
| `shadowclone migrate skills` | Preview migration from an older profile installation |
| `shadowclone mcp` | Serve context and maintenance tools to a connected agent |

Supported agent identifiers are `claude-code`, `codex`, `cursor`, and `antigravity`. Optional local Claude subagents use `--subagent`; automatic delegation is a separate `--auto-delegate` choice. Run `shadowclone --help` for the command reference.

</details>

**Further reading:** [Documentation index](docs/README.md) · [Architecture](docs/architecture/README.md) · [Design history](docs/design/README.md) · [Migration](docs/migration.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

Shadowclone is MIT licensed.
