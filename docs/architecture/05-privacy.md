# Privacy

Shadowclone learns engineering taste from consented agent transcripts and existing instructions so the main agent and delegated clones inherit the same preferences. Each clone writes its own agent transcript. Those sessions can feed later learning and improve the shared profile. This useful loop starts with sensitive material, so source consent, local storage, and redaction are part of the product boundary.

First-party tools such as Claude Code's `/doctor` inspect one vendor's instruction files and rightsize them toward general practice. They do not learn from the user's corrections across sessions or keep several agents in sync. Anthropic's suggested instruction to "match the surrounding code's comment density" would erase this repository's explicit zero-comments preference. Shadowclone preserves user-specific choices backed by what the user wrote and did.

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

## One redaction gate

Agent events in the disposable SQLite index carry `TextRef` pointers, event kinds, timestamps, and tool metadata. They do not carry captured text. `resolveRedacted` in `src/redact/` is the only exported function that turns a captured pointer into text. It calls `redactSecrets` before the excerpt can reach distillation, an authenticated agent CLI, or a model-facing evaluation snapshot. Repository guidance and consented agent context also pass through this gate. Raw transcripts are never copied into a Shadowclone store.

Learning admits user-authored steering episodes and limited assistant context. Tool results, file contents from Read, Edit, or Write, thinking blocks, and data-access results are excluded by category. Redaction still removes recognized credentials, secret assignments, private hosts, paths, and high-entropy tokens from eligible material. Stored rule and rejection identities are replaced with opaque prompt tokens before reconciliation.

The first setup learning pass uses the newest eligible episodes and a 90-second whole-run deadline. It may finish with no write when that budget expires. Manual `learn --deep` processes the oldest unprocessed episodes in bounded batches. A session-end hook alone does not start learning; the main agent must first mark a useful session under separate deep and automatic consent. `SubagentStart` gives a spawned Claude subagent the compiled profile without requesting another learning run.

## Local ownership and egress

The profile lives as Markdown under `~/.shadowclone/profile/`. The user can open, edit, reject, or delete its rules. Local history stores before and after profile text so undo can detect conflicts. The index, learning ledger, checkpoints, skill proposals, eval receipts, and installation manifests stay under the user's Shadowclone home and contain no second transcript copy.

Learning and evaluation send only redacted excerpts through the user's own authenticated `claude`, `codex`, or `cursor-agent` CLI. A remote dispatch action needs separate approval for that run. Shadowclone has no service, API key, account, or telemetry endpoint. The engine CLI and the transcript files retain the trust boundaries they already had before Shadowclone was installed. Headless dispatch has a separate per-action policy for commits and remote actions.

Skill maintenance has its own default-off `skill-library` source. It reads enabled `SKILL.md` files, sends redacted contents for assessment, and checks referenced files locally without reading or executing them. User-owned technical and routing changes remain pending for review; plugin packages remain unchanged.

Logs report counts, sizes, hashes, and source names. Transcript paths can identify a project, so errors and ordinary logs do not print them or raw excerpts.

## One-step wipe

```bash
shadowclone forget --all
```

The command removes the local profile, index, learning state, checkpoints, receipts, and recorded managed integrations. It preserves unrelated agent instructions and stops if edited managed content would be lost. The original Claude Code, Codex, Cursor, Antigravity, and shell histories remain untouched. Older installations without a manifest may need `shadowclone uninstall` from their repository first.
