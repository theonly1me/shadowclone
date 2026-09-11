# Data handling

Shadowclone builds an editable behavioral profile from sources enabled on the user's machine. It invokes installed, authenticated agent CLIs for model work. The project does not operate a hosted collection service or implement analytics, crash reporting, or background profile upload. The agent providers have their own data handling, account, and retention terms.

## Consent and sources

Transcript and history sources default to off. `shadowclone init` asks which available sources to enable. Onboarding may check whether configured roots exist and are non-empty before consent so it can omit absent sources; it does not read transcript contents during that check.

Enabled adapters read Claude Code, Codex, Cursor, Antigravity, or shell history from the configured locations. Git remote discovery has separate `git-metadata` consent. Repository instruction import has `declared-rules` consent. Evaluation instruction, skill, and memory import has separate `agent-context` consent. Disabling a source stops future use of its source evidence; it does not automatically erase existing derived profile rules or provider-retained requests.

Transcript parsing records event categories, timestamps, working directories, tool names, and references to eligible text. Tool-result payloads and thinking blocks are not eligible learning evidence. Parsers may encounter these categories while reading an enabled transcript; exclusion from learning is not a claim that their bytes are never read. User prompts and assistant responses can themselves contain sensitive or third-party information.

## Local storage

| Location | Contents |
| --- | --- |
| `~/.shadowclone/config.toml` | Source consent, model settings, and repository action ceilings |
| `~/.shadowclone/index.db` and SQLite sidecars | Event metadata, working directories, text references, cursors, and observed origin bindings |
| `~/.shadowclone/profile/` | Editable Markdown rules, generated-state records, rejected wording, and compiled profiles |
| `~/.shadowclone/distill/` | Distillation checkpoints containing derived model results and fingerprints |
| `~/.shadowclone/runs/` | Private dispatch receipts, compiled guidance, and approved remote-action drafts |
| `~/.shadowclone/worktrees/` | Local task checkouts, including work that may be uncommitted |
| `~/.shadowclone/eval/` | Private frozen tasks, redacted evidence, profiles and context in `state.json`; cumulative usage in `budget.json`; reduced `report.json` |
| Repository `.claude/` | Installed agent and optional delegation skill, which can contain compiled guidance |

Generated state uses owner-only file permissions and private directories on supported systems. It is not encrypted by Shadowclone. Checkout file modes remain intact beneath a private worktree parent. Accounts or processes with equivalent user privileges, administrator access, or access to backups may still read the data.

Transcript ingestion processes bounded 8 MiB windows and continues from its cursor on later invocations. Individual records over 1 MiB are omitted with counts. Cursor SQLite stores exceeding the current 8 MiB aggregate blob limit are skipped with a diagnostic. File materialization rejects changed captured bytes and unsafe paths. Provider output over its limit terminates the process and is treated as failure.

Observed source/session/directory bindings survive ordinary schema migration and index rebuilding. A new index records when observation began; older unbound sessions remain isolated. Deleting the index loses those bindings. Legacy scope directories migrate only when their mapping is unambiguous.

The index does not duplicate whole transcript text. Deep-learning checkpoints and evaluation state can retain selected or derived content, so these are additional sensitive artifacts. Temporary evaluation snapshots contain repository files and optional frozen context; normal completion and handled failures remove them. An abrupt process or machine failure can leave temporary directories for manual cleanup.

## Materialization and model requests

File references are checked for valid ranges, size limits, regular-file type, and authorized root containment. Profile metadata and model-facing text come from the same bounded snapshot. The shared materialization layer applies the existing redaction rules before imported guidance and selected learning evidence reach a model.

Redaction recognizes specific token, hostname, path, and entropy patterns. It can miss credentials, personal information, confidential prose, and unusual formats. It can also remove harmless text. It is not a general confidentiality filter or a guarantee that a request contains no sensitive information. Inspect enabled sources and the resulting profile before using them with a provider.

Plain `learn` performs local indexing and reporting. `learn --deep`, transfer evaluation, and agent execution invoke the selected authenticated provider. They can transmit eligible excerpts, profiles, instructions, tasks, and observed task outputs through that provider. A deep dry run still performs model work. Provider charges and retention depend on the account and provider; local deletion does not delete provider copies.

## Acting and evaluation

A headless `run` authorizes a local branch, worktree, and commit of a successful agent result. Remote operations require both repository policy and matching per-run grants. PR replies additionally name a PR number. Live installed agents run within the host agent session's permissions; they do not inherit the separate headless execution boundary.

Headless dispatch requires the primary repository checkout as its target and disables native hooks and integrations and restricts the process and tools. Host helpers perform approved Git/GitHub operations with validated targets. PR titles and bodies pass through pattern redaction before submission. Approved pushes transmit the branch commits, including repository file contents; Git objects are not redacted by Shadowclone. These controls depend on the supported agent CLI and operating-system sandbox and do not promise protection from a compromised operating system or provider runtime.

Transfer evaluation uses the user's authenticated agent with its documented host-read permissions. An outer wrapper confines writes to the invocation workspace. Authentication refresh requiring writes outside that workspace must happen before evaluation. Independent verification scripts receive a separate restricted environment with no provider credentials or network, private temporary storage, and bounded output and lifetime. Unsupported isolation prevents verification from running. Verifier stdout is not supplied to the semantic judge.

The public evaluation report and `--json` output contain counts, verdicts, opaque identifiers, and fingerprints. They exclude frozen prompts, profile text, evidence excerpts, and absolute paths. These fields are reduced data, not a formal anonymity guarantee. Full resumable state remains private. Concurrent resume attempts are locked out; after abrupt termination, confirm the old process has ended before removing that evaluation's `.running` lock. Preserve `budget.json`. Dollar-budget accounting is cumulative; native provider limits may not stop an already in-flight charge at an exact invoice amount.

## Retention, correction, and deletion

There is no automatic expiry policy or daemon uploading profiles. Edit profile Markdown to correct it, remove rules to reject them, and disable sources in configuration to stop using their future evidence. Session-end ingestion updates the index; explicit deep learning remains required to reconcile learned profile changes.

`shadowclone install` and `shadowclone uninstall` require a repository root. Uninstall removes matching installed artifacts in that repository and preserves files whose content has changed or whose ownership cannot be established. Older installations without fingerprints may require manual removal. Run `shadowclone doctor` after upgrading to migrate unambiguous legacy origin directory names; ambiguous scopes remain excluded until reviewed. Skipped artifacts are not evidence of successful deletion.

`shadowclone forget --all` deletes the Shadowclone state directory, including its worktrees and private evaluation state. It also attempts removal of recorded, matching repository installations. Preserve unfinished work before running it. It does not delete source transcripts, external repositories, host agent configuration, remote branches or PRs, provider data, backups, or Git history. Modified or unverifiable installation artifacts remain for manual cleanup. Source-specific and repository-specific forget flags are not implemented.

## Managed policy and reporting

Supported root-owned managed configuration can disable the tool or restrict sources, engines, origins, and action tiers. It controls this installation, not other tools running under the same account. `local-only` prevents hosted distillation; a local model engine is not implemented.

Report vulnerabilities privately through the repository Security tab. Share synthetic examples and aggregate diagnostics; do not attach transcripts, private resume state, credentials, or identifying paths to public reports. See [SECURITY.md](../SECURITY.md).
