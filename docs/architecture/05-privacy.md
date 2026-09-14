# Privacy

Shadowclone learns engineering taste from consented agent transcripts and existing instructions so the main agent and delegated clones inherit the same preferences. Each clone writes its own agent transcript. Those sessions can feed later learning and improve the shared profile. This useful loop starts with sensitive material, so source consent, local storage, and redaction are part of the product boundary.

Local storage does not imply offline inference or anonymity. The user must be authorized to send selected input to the configured provider. Redaction reduces known risks but cannot identify every sensitive detail.

## Named consent

Every source has its own flag in `~/.shadowclone/config.toml`, and every flag defaults off. Default `shadowclone init` lists detected source paths before asking one grouped question for transcripts, Git remote names, and agent context. Separate questions cover skill maintenance and background learning. `init --advanced` asks about each source individually. A managed policy can narrow consent but cannot broaden it.

| Source | Path |
| --- | --- |
| Claude Code | `~/.claude/projects/` |
| Claude prompts | `~/.claude/history.jsonl` |
| Codex | `~/.codex/sessions/` or `$CODEX_HOME/sessions/` when set |
| Cursor | `~/.cursor/chats/` |
| Antigravity | `~/.gemini/antigravity-cli/brain/` |
| Shell | `~/.zsh_history`, `~/.bash_history` |
| Declared repository rules | root `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and direct skill files under `.claude/skills/` or `.agents/skills/` |
| Agent context | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.codex/AGENTS.override.md`, supported personal and repository skill roots, and `~/.claude/projects/<repo>/memory/` or `~/.codex/memories/`, only for evaluation |
| Skill library | `~/.claude/skills/`, `~/.agents/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, `~/.gemini/config/skills/`, configured repository roots, and selected provider plugin caches |
| Git metadata | repository remote names |

Before consent, setup checks only whether a configured root exists and has content. It reduces that check to a temporary boolean. It reads at most one directory entry and retains no name or path. Absent transcript sources stay disabled even if the grouped answer is yes. The local instruction and skill roots are read only after their corresponding consent.

Evaluation has a separate code-evidence boundary. Coding agents can read the selected committed repository snapshot. Changed files, diffs, and recorded actions then go to the judging model without redaction so code semantics remain intact. That evidence can contain sensitive code or identifiers. Use only authorized repositories, keep receipts private, and review any public summary. The personal context directory is excluded from collected files; all arms retain the same repository guidance.

## One redaction gate

Agent events in the disposable SQLite index carry `TextRef` pointers, event kinds, timestamps, and tool metadata. They do not carry captured text. `resolveRedacted` in `src/redact/` is the only exported function that turns a captured pointer into text. It calls `redactSecrets` before the excerpt can reach distillation, an authenticated agent CLI, or a model-facing evaluation snapshot. Repository guidance and consented agent context also pass through this gate. Raw transcripts are never copied into a Shadowclone store.

Learning admits user-authored steering episodes and limited assistant context. Tool results, file contents from Read, Edit, or Write, thinking blocks, and data-access results are excluded by category. Redaction still removes recognized credentials, secret assignments, private hosts, paths, and high-entropy tokens from eligible material. Stored rule and rejection identities are replaced with opaque prompt tokens before reconciliation.

The first setup learning pass uses the newest eligible episodes and a 90-second whole-run deadline. It may finish with no write when that budget expires. Manual `learn --deep` processes the oldest unprocessed episodes in bounded batches. A session-end hook alone does not start learning; the main agent must first mark a useful session under separate deep and automatic consent. `SubagentStart` gives a spawned Claude subagent the compiled profile without requesting another learning run.

## Local ownership and egress

The profile lives as Markdown under `~/.shadowclone/profile/`. The user can open, edit, reject, or delete its rules. Local history stores before and after profile text so undo can detect conflicts. The index, learning ledger, checkpoints, skill proposals, eval receipts, and installation manifests stay under the user's Shadowclone home and contain no second transcript copy.

Learning sends eligible redacted excerpts through the user's authenticated `claude`, `codex`, or `cursor-agent` CLI. Evaluation also exposes the authorized repository snapshot and generated code described above. Headless dispatch exposes the chosen worktree to its engine and has a separate per-action policy for commits and remote actions. Shadowclone has no service, API key, account, or telemetry endpoint. Reusing authentication does not replace source consent or an organization's rules about model use.

Skill maintenance has its own default-off `skill-library` source. It reads enabled `SKILL.md` files, sends redacted contents for assessment, and checks referenced files locally without reading or executing them. User-owned technical and routing changes remain pending for review; plugin packages remain unchanged.

Logs report counts, sizes, hashes, and source names. Transcript paths can identify a project, so errors and ordinary logs do not print them or raw excerpts. Validated judge explanations and bounded attempt diagnostics are redacted before persistence. Local code-evidence receipts remain sensitive even when printable output has been redacted.

## One-step wipe

```bash
shadowclone forget --all
```

The command removes the local profile, index, learning state, checkpoints, receipts, and recorded managed integrations. It preserves unrelated agent instructions and stops if edited managed content would be lost. The original Claude Code, Codex, Cursor, Antigravity, and shell histories remain untouched. Older installations without a manifest may need `shadowclone uninstall` from their repository first.
