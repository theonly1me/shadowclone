# Data handling

Shadowclone reads sources you enable and maintains local coding-agent guidance. It has no hosted collection service, analytics, crash reporting, or automatic upload of your environment. Model work uses your installed, authenticated agent CLI and is subject to that provider’s account and retention terms.

## Consent

Source settings live in `~/.shadowclone/config.toml` and default to off. Default setup names detected paths before asking about session access, skill maintenance, and background learning. `init --advanced` offers individual source choices. Managed policy can restrict these settings.

Before consent, setup may check whether a configured source root exists and contains data. It reduces that check to a temporary boolean, without opening source contents or retaining entry names. Reading source contents requires the corresponding setting.

Source access does not by itself authorize automatic skill edits. Disabling a source excludes its indexed events from later learning selection and rechecks authorization before each text reference is resolved. Pending approval also checks its saved source provenance against current effective consent. It does not erase existing published guidance or requests retained by a provider. Review and retire existing guidance separately if it should no longer be used.

## Sources

| Setting                  | What may be read                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude-code`            | Session JSONL under `~/.claude/projects/`                                                                                                                                                   |
| `claude-prompts`         | `~/.claude/history.jsonl`                                                                                                                                                                   |
| `codex`                  | Sessions under `~/.codex/sessions/`, or `$CODEX_HOME/sessions/`                                                                                                                             |
| `cursor`                 | Chat databases and metadata under `~/.cursor/chats/`                                                                                                                                        |
| `pi`                     | Version 3 session JSONL under `~/.pi/agent/sessions/`, or `$PI_CODING_AGENT_DIR/sessions/`; original files remain untouched                                                                 |
| `antigravity`            | Generated conversation logs under `~/.gemini/antigravity-cli/brain/`                                                                                                                        |
| `antigravity-workspaces` | `~/.gemini/antigravity-cli/history.jsonl` for workspace attribution                                                                                                                         |
| `declared-rules`         | Repository-root `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and direct `SKILL.md` files under `.claude/skills/` and `.agents/skills/`                                                         |
| `claude-rules`           | Markdown rules under the current repository’s `.claude/rules/` for compatible native guidance                                                                                               |
| `claude-memory`          | Claude memory under `~/.claude/projects/<repo>/memory/`; recurring extraction requires registered repositories with verified identity                                                       |
| `agent-context`          | Selected-agent personal instructions and skills, kept as an original baseline and copied into evaluation arms                                                                               |
| `skill-library`          | Consented personal, repository, custom, and third-party skill roots                                                                                                                         |
| `git-metadata`           | Local repository remote names used to determine scope                                                                                                                                       |
| `github-writing`         | Through your `gh` login: your 40 newest pull request titles and bodies, your 40 newest reviews with up to 10 comments each, and your 60 newest commit messages, for voice capture only      |
| `repository-manifests`   | Scripts and dependency names in `package.json`, lockfile names, `pyproject.toml`, `requirements.txt`, `Makefile` targets, CI workflow files, and top-level entry names for repository setup |

Shell history is not a source. Upgrading deletes indexed shell history events, cursors, and repository bindings, and Shadowclone ignores a `shell` setting left in an older `config.toml` or managed policy.

Personal skill locations include `~/.agents/skills/`, `~/.claude/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, and `~/.gemini/config/skills/`. Configured provider plugin caches may also be reviewed. Codex paths follow `$CODEX_HOME` when set.
Evaluation context can include `~/.claude/CLAUDE.md`, Codex `AGENTS.md` and `AGENTS.override.md`, and the selected skill catalog. Each study freezes its selected inputs. See [evaluation](architecture/09-evaluation.md) for the protocol.

The preference study keeps suites, keys, agent homes, and receipts in a private directory outside every checkout. Each candidate receives separate workspace and agent-home copies. Native filesystem policies deny credential reads and network access. Authentication is copied temporarily for the selected CLI and removed in cleanup. Candidates may write Git history inside their disposable workspace and its local remote, and an offline `gh` stub records pull request requests. Learning reads only consented sources through the normal redacted path.

The preference benchmark uses independently authored synthetic tasks, expected guidance, manual skills, and correction sessions. Eight held-out cases and every receipt stay outside checkouts; public material contains hashes and aggregate coverage only. Review and offline validation authorize no model calls. Three independent preparations use one pinned Codex learner through production ingestion and `resolveRedacted`, retaining published, missing, pending, and suspected unsupported guidance. Only isolated synthetic transcript and skill sources are enabled; synthetic Git metadata supplies repository scope. Managed restrictions remain authoritative. The separate routing experiment requires no learning. Each authenticated phase needs a newly approved fingerprint, model, host, and invocation ceiling. [Evaluation methods](guides/evaluations.md) document the private bundle and diagnostics.

Explicitly authorized scored execution sends the synthetic repository, prompts, and selected guidance to the selected provider. Generated responses, code, traces, frozen inputs, learning receipts, scores, and identifying local paths remain in private evaluation storage outside every checkout. Generated execution evidence never becomes learning input. See [evaluation methods](guides/evaluations.md).

Transcript parsers can encounter prompts, assistant responses, tool results, and thinking blocks while reading an enabled file. Tool-result payloads, tool-returned file contents, thinking, and data-access results are excluded from learning. Only user-authored text counts as learning evidence. Agent responses, presented plans, and agent questions reach the model only as labeled context next to a user correction. Eligible text can still contain sensitive information.

Pi capture retains parent links across session branches. Its system and custom injected messages, compaction records, and branch summaries are excluded. Pi transcript consent is separate from Git metadata and skill maintenance. Session start records repository identity only when both Pi capture and Git metadata are enabled.

## What reaches a model

| Operation                   | Provider access                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plain `learn` after setup   | Local indexing and reporting; no model calls                                                                                                         |
| Deep or background learning | Selected redacted steering, supporting context, and guidance needed for reconciliation                                                               |
| Skill maintenance           | Redacted catalogs and full instructions for overlapping workflows, plus evidence for proposed updates; supporting resources are checked locally      |
| Browser editor              | Opening the editor makes no model request; build naming sends redacted skill titles and summaries; voice capture and skill drafts need a user action |
| Personal GitHub clone       | Reviewed exported guidance, the selected repository, and an authorized issue or PR task                                                              |
| `shadowclone-work` skill    | The existing agent session reads the skill and its own workspace; Shadowclone makes no model calls for it                                            |
| Pull request review         | The PR title and description, diff, file history, standards from the base commit, rule hits, toolchain diagnostics, and files the reviewer reads     |
| Evaluation                  | Synthetic task workspaces and the tested setup's skills and instructions; judges receive generated code without redaction                            |

First-time interactive `learn` can offer setup, which may make an authorized first learning pass. A deep dry run still calls a model.

Pi session learning uses a private, token-authenticated socket to the running harness's provider-neutral model API. The directory is private to the user and disappears on shutdown. Only prepared redacted input reaches the model, with no tools or coding-session context. Standalone requests use temporary private files, remove them in cleanup, and invoke the installed Pi CLI. Pi retains provider configuration and credential resolution, including its trusted extensions and environment-backed custom provider credentials. Shadowclone stores only model references. A missing live bridge or selected model fails without a provider fallback.

Eligible source text crosses the shared redaction boundary before learning or context import. Redaction detects known token, host, path, and entropy patterns. It can miss confidential prose, personal information, and unusual secrets, and can remove harmless text. It is not an anonymity guarantee.

Use only material you are authorized to send to the chosen provider. Provider usage limits or charges may apply. Local deletion does not delete provider copies.

## Local files

Earlier versions kept delegated task records under `~/.shadowclone/runs/`, grants under `~/.shadowclone/task-grants/`, and task worktrees under `~/.shadowclone/worktrees/`. Shadowclone no longer creates them. `forget --all` stops while old worktrees remain, so unfinished changes are not deleted; move or remove them yourself.

| Location                                | Contents                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.shadowclone/config.toml`            | Source consent and model/action settings                                                                                                       |
| `~/.shadowclone/environment.json`       | Learned guidance, scope, evidence, publication decisions, and builds                                                                           |
| `~/.shadowclone/index.db` and sidecars  | Event metadata, source references, cursors, and origin bindings                                                                                |
| `~/.shadowclone/profile/`               | Legacy profile state and recovery artifacts                                                                                                    |
| `~/.shadowclone/distill/`               | Derived learning checkpoints and fingerprints                                                                                                  |
| `~/.shadowclone/learning-pending.json`  | Learned rules awaiting approval, named source provenance, and keys explicitly rejected during review                                           |
| `~/.shadowclone/learning-attempts/`     | Private receipts with outcome codes, counts, and next actions, without raw excerpts or transcript paths                                        |
| `~/.shadowclone/learning-feedback.json` | Opaque evidence hashes, rule and guidance identifiers, source names, correction times, and explicit review acknowledgements                    |
| `~/.shadowclone/learning-probes/`       | Bounded native probe receipts with task and guidance hashes, provider metadata, outcomes, and loading observations; no prompt or response text |
| `~/.shadowclone/skills.json`            | Configured roots, maintenance ownership, and cached library review fingerprints                                                                |
| `~/.shadowclone/skill-proposals/`       | Proposed edits and conflicts with redacted supporting passages and required decisions                                                          |
| Other files under `~/.shadowclone/`     | Revisions, installation ownership, original-library snapshots, and learning/skill ledgers                                                      |
| `~/.shadowclone/runs/` and `worktrees/` | Records and worktrees left by earlier versions, which may hold unfinished changes                                                              |
| Agent skill and instruction directories | Published skills, resources, native routing, and hooks                                                                                         |
| Repository harness files                | Reviewed shared instructions, skills, and checks intended for version control                                                                  |

Shadowclone does not copy whole transcripts into its store. The index holds references and event metadata. Learning records, checkpoints, and original-library snapshots can still contain sensitive derived or selected content.

Generated state uses private directories and owner-only permissions where supported. Shadowclone does not encrypt it. Processes with equivalent access, administrators, and backups may still read it. Interrupted evaluation can leave temporary workspaces in its private study directory for manual cleanup.

## Scope and editing

Repository learning stays with the registered repository. Setup and deep learning register the working repository only when Git-metadata consent and skill maintenance are enabled and its remote identity verifies. Past sessions from before metadata consent stay isolated until the user confirms a current directory-to-remote association. Blocked and unknown origins stay unregistered. Organization learning uses a normalized remote-owner identity, which is a technical scope and does not verify a legal employer boundary. Explicit global guidance applies across repositories. Guidance that names a repository, codebase, or repository path never receives global scope, even when the learning model assesses its evidence as global. Without Git-metadata consent, working directories remain isolated.

Automatic skill maintenance requires separate write authorization. Conflicting edits stay pending. Before any model sees a learned rule from captured sessions, a local check looks for text that reads like instructions to an agent: requests to ignore other instructions, imitated system or role messages, a download piped into a shell, requests to send secrets, hidden or direction-changing characters, and long encoded strings. A flagged rule stays pending with its reasons, and nothing publishes it. Rules that the user wrote or chose are not checked. Native memory and third-party packages remain unchanged. Revisions record files together and refuse an undo that would overwrite later edits.

Shared repository output is visible to anyone with repository access once committed. Setup asks separately before including personal guidance. The browser editor also offers private repository builds. Review shared output before committing it.

## Execution

Outside personal GitHub clone setup and pull request reviews, Shadowclone does not commit, push, or act on GitHub itself. The `shadowclone-work` skill acts through the host agent's own tools and permissions. A push sends Git objects, including repository code, without redacting them. Review comment text is untrusted data and is excluded from learning.

A local pull request review fetches the PR refs, reads them in temporary worktrees, and removes the worktrees afterwards. Its toolchain checks run the PR's own configuration as you, with dependency install scripts off and only tool-related environment variables; `--no-checks` skips them. The review model can only read files inside the head worktree. The result stays in `~/.shadowclone/reviews/`. `--cloud` posts one `@shadowclone review` comment as you, and the clone posts the review. Cloud review results pass between jobs as artifacts that expire after one day. Posted text is redacted, and mentions and cross-repository links are wrapped in code spans. Review output never becomes learning input.

Evaluation confines candidate writes to disposable workspaces. Verification runs separately without provider credentials or network access and does not send verifier stdout to judges. These controls depend on the supported provider and operating-system sandbox. [Execution](architecture/04-acting.md) and [evaluation](architecture/09-evaluation.md) describe their contracts.

Evaluation retains raw native stdout and stderr under its private attempt storage so skill-read observations can be audited after workspace cleanup. These artifacts may contain generated code, synthetic guidance, and identifying runtime paths. They are excluded from public reports and from every learning source. Confirmed provider quota refusals pause dispatch; their diagnostics and consumed calls remain recorded. Reused preparation outputs retain their original source and product hashes without another model request.

Public synthetic evaluation inputs include fixed correction sessions and their synthetic observed repository bindings. Preparation verifies the private fixture's registered identity and replays those bindings through the normal index API. This does not retroactively associate a user's unbound history with a current remote. Source seals include fixture setup; changed learning inputs require new authorized preparation, while compatible completed outputs remain reusable without model calls.

Native Codex evaluation explicitly denies shared `/tmp` and `/private/tmp` access while granting narrower workspace and private temporary paths. Evaluation validation exercises the actual CLI permission profile without credentials or model calls before Codex dispatch. It checks unrelated temporary reads and writes, answer access, guidance protection, and read-only tasks with memory enabled and disabled. Claude's native sandbox still requires separate host qualification.

The browser editor listens on loopback, serves local assets, checks request origins, and uses an ephemeral token. Opening it does not grant new capture consent.

Skill discovery reads only configured, consented roots. It permits up to 2,000 distinct physical skill files and 8 MB in total; overlapping roots count the same canonical file once. Native copies may collapse into one browser entry. Individual skills retain their 48 KB and 500-line limits, and discovery refuses paths nested more than twelve levels.

Build naming sends the redacted titles and one-line summaries of the equipped skills and preferences. It never sends skill bodies, paths, repository names, or ownership metadata. It runs 5 seconds after the last equip change, or when the user chooses **Name my build**. It uses the fast model of the engine with no tools, one call, a 30-second deadline, and a $0.05 limit where the provider supports a dollar cap. On Claude Code, the fast model runs with thinking off and a one-sentence system prompt in place of the default one. The character sheet names the engine and model. **Turn naming off** stores the choice in that browser and stops every naming request. Results stay in server memory until the editor closes.

Voice capture needs the `github-writing` setting. The **My voice** dialog in the editor turns it on or off, and managed policy can block it. With the setting off, the editor makes no `gh` call. Capture reads only text that the signed-in user wrote. It skips pull requests from `codex/`, `claude/`, and `cursor/` branches, text with agent attribution lines, release pull requests, and merge and revert commits. It removes fenced code, comments, and images, redacts each item through `redactSecrets`, and keeps at most 1,200 characters per item and 24,000 in total. One call to the saved learning model describes the voice and writes 3 invented examples, with a 120-second deadline and a $0.25 limit where the provider supports a dollar cap. A result that copies 8 or more words in a row from the writing is discarded. The dialog shows only the description and the invented examples. Rewriting the examples after an edit sends only the edited description to the fast model. Collected writing stays in server memory until the editor closes or the setting is turned off. Saving writes `~/.agents/voice.md` only when no file or link exists at that path.

Use AI in the skill editor sends only the typed form fields. It reads no repository files. Model requests use the learning execution contract with no tools, one call, and a 60-second deadline. Providers with dollar-cap support receive a $0.25 limit; other providers show that no dollar cap can be enforced. Cancellation aborts the request, but usage already incurred may still be charged. Reviews and cached results remain in server memory until the editor closes. Generated skill drafts remain editable and require the usual build review before publication.

## Personal GitHub clones

`bot setup` authorizes reading the current repository origin for that setup without enabling ongoing Git metadata capture. Managed source, engine, blocked-origin, and action restrictions still apply. The browser previews selected scoped skills, resources, plugin metadata, and native rules through the existing redacted delivery boundary. It excludes transcripts, source history, receipts, and raw learning records.

App registration and installation require the owner's GitHub browser interaction. Setup rejects All repositories and checks repository IDs. Guidance upload and subscription use require approval of the exact preview in the local browser. MCP can start setup or return saved status; it provides no activation or credential operation.

App registration credentials and the preview stay in server memory until shutdown. The documented `claude setup-token` flow produces a credential that the owner pastes into a loopback password request. Setup never extracts an existing interactive credential. GitHub CLI receives secrets through stdin, and diagnostics exclude credentials. Non-secret installation metadata lives under `~/.shadowclone/cloud/installations/`. Explicit exports use owner-only files outside the checkout and remain until deleted.

The App private key, subscription token, and bounded guidance bundle become secrets in a default-branch-only GitHub environment. Existing approval settings remain intact. The default-branch workflow and code executed with credentials remain trusted. Each cloud worker receives an App token for one repository and sends the authorized repository task and guidance to Claude. The private App key stays outside the coding agent. A `shadowclone default branch` ruleset lets only people with write access update the default branch, so the App token cannot push or merge there.

Owner issues and approved tagged requests grant work within their stated scope. Validated checks and reviewer findings can resume managed PRs. Forks, other repositories, unapproved authors, and clone comment loops cannot dispatch work. A pause label blocks dispatch and cancels matching worker runs. The model receives instructions to check pause state before writes; cancellation cannot make an already-started write atomic. The clone opens draft PRs and can mark them ready, but the owner merges.

Cloud tasks and exported guidance are not new learning sources. GitHub and the selected provider apply their retention policies. Local guidance changes do not automatically update the frozen cloud bundle. See [GitHub clones](guides/github-clones.md) for installation, limits, and removal.

## Retention and removal

There is no automatic expiry policy. Use `learning disable` to stop background learning and source settings to stop future reads. Use `skills automatic off` to stop automatic skill edits. Review active guidance with `learning list`, `learning show`, or `context --explain`, and reverse a revision with `undo`. `learning retire`, `replace`, `narrow`, and `remove-source` preview explicit changes before application. Source removal preserves mixed-source and unresolved records for individual review and never removes original transcripts or memory.

`uninstall --global` removes recorded global integrations; `uninstall --local` removes recorded integrations in the current repository. Ownership checks preserve unrelated content and refuse conflicting managed edits. Legacy artifacts without ownership records may need manual removal.

`shadowclone forget --all` restores or removes recorded managed files and deletes Shadowclone’s local state, including task worktrees and original snapshots. Preserve unfinished work first. A conflicting maintained file can stop the operation before it completes.

Original transcripts, native memory, provider-retained requests, external repositories, backups, remote branches, PRs, and Git history remain. Repository harness files remain too; use `undo` before deleting revision history, or remove them through version control. There are no source-specific or repository-specific forget flags.

## Managed installations and reports

Root-owned managed policy can disable Shadowclone or restrict sources, engines, origins, and action tiers. It governs this installation, not other programs under the same account. `local-only` blocks hosted learning; a local model engine is not implemented.

Report exposures privately through [security reporting](../SECURITY.md). Public reports should contain synthetic examples and reviewed summaries, never raw transcripts, private receipts, credentials, or identifying paths.
