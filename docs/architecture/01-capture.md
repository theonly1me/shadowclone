# Capture

## Sources

Every source is opt-in, named in the config, and listed in the README. The config lives at `~/.shadowclone/config.toml` and every source defaults to off. `shadowclone init` is the only thing that turns any of them on, and it names each one as it does.

| Source | Path | Default | Notes |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude/projects/**/*.jsonl` | off | Session transcripts, the primary source |
| `claude-prompts` | `~/.claude/history.jsonl` | off | Prompts in the user's own words |
| `codex` | `~/.codex/sessions/**/*.jsonl` | off | Date partitioned rollouts |
| `cursor` | `~/.cursor/chats/**/store.db` | off | Per session SQLite, not JSONL |
| `git-metadata` | observed repositories' local `remote.origin.url` | off | Organization scope only, never repository contents |
| `shell` | `~/.zsh_history`, `~/.bash_history` | off | The original source, kept and demoted |

Reading a path to see whether it exists is reading. Nothing under a disabled source is opened, including an existence check.

`git-metadata` is separate consent because transcript consent does not imply permission to inspect a repository. When it is disabled, each working directory is hashed into its own isolated origin and its rules never promote to global. When enabled, shadowclone asks git for the local remote origin and reads no repository content.

## The normalized event

Every adapter produces the same type. The stage boundary is `observeAll`, and nothing downstream knows which provider an event came from unless it asks.

```ts
export type TextRef = {
  readonly sourcePath: string;
  readonly byteOffset: number;
  readonly byteLength: number;
};

export type AgentEventKind =
  | "user-prompt"
  | "assistant-text"
  | "thinking"
  | "tool-call"
  | "tool-result"
  | "plan-presented"
  | "plan-resolved"
  | "question-asked"
  | "question-answered"
  | "permission-denied"
  | "session-end";

export type AgentEvent = {
  readonly source: SourceId;
  readonly sessionId: string;
  readonly eventId: string;
  readonly parentEventId: string | null;
  readonly timestamp: number;
  readonly cwd: string;
  readonly gitBranch: string | null;
  readonly kind: AgentEventKind;
  readonly tool: ToolCall | null;
  readonly isError: boolean;
  readonly textRef: TextRef | null;
};
```

`AgentEvent` carries no text. It carries a pointer to text. That is the central decision in this document and `05-privacy.md` explains why.

## Incremental reads

The corpus grows about 19 MB a day on a single active machine. Full rescans are not an option after the first run.

Each file gets a cursor row: `sourcePath`, `byteSize`, `modifiedAt`, `byteOffset`. Transcripts are append only JSONL, so a later run seeks to `byteOffset` and reads forward. Three cases have to be handled and each has a defined answer.

`byteSize` is larger and `byteOffset` still lands on a newline boundary. Read forward from the offset. This is the normal case.

`byteSize` is smaller than the recorded `byteOffset`. The file was truncated or rewritten. Discard the cursor, delete indexed events for that path, and rescan from zero.

`byteSize` is unchanged and `modifiedAt` moved. Treat as a rewrite and rescan. Cheap, and it beats reading a stale offset into the middle of a record.

A partial trailing line is never parsed. The cursor advances only to the last byte that completed a record, so a transcript being written to right now is safe to read.

## Claude Code adapter

The format has four traps and all four have bitten this design already.

**Assistant records are one per content block.** A single API message is written as several records sharing `message.id` and `requestId`, each carrying one block and an `apiBlockIndex`. Counting records as turns overcounts by roughly three times. Group by `message.id` before deriving anything about turns or pacing.

**Tool results arrive as user records.** A `user` record whose `message.content` is an array of `{tool_use_id, type: "tool_result", content, is_error}` is a result, not a prompt. A `user` record whose `message.content` is a plain string is a real typed prompt. The type of that field is the discriminator.

**Subagent transcripts are not linked by path.** They live at `<sessionId>/subagents/agent-<hex>.jsonl` with `isSidechain: true` and an `agentId`. The parent file never names them, so the adapter walks the directory.

**Records with `isMeta: true` are harness injected, not user authored.** They must not enter the prompt corpus, because they will otherwise be learned as the user's voice.

Useful fields on the envelope: `parentUuid`, `uuid`, `promptId`, `sessionId`, `timestamp`, `cwd`, `gitBranch`, `permissionMode`, `version`.

## Other adapters

**Codex** writes `{timestamp, type, payload}` with no uuid chain, so order is the chain. `response_item` and `event_msg` are redundant views of the same turn. Read `response_item` and drop `event_msg`, or every turn counts twice.

**Cursor** stores chat state as a SQLite `store.db` per session under a workspace hash, with `meta.json` alongside carrying `cwd` and timestamps. It is a different reader, not a different parser, which is why it lands last.

**Shell** is the existing `getRecentShellHistory`, rewritten to emit `AgentEvent` values with `kind: "user-prompt"` and no session grouping.

Timestamps disagree across sources and are normalized to epoch milliseconds at ingest. Claude transcripts use ISO-8601 strings, `~/.claude/history.jsonl` uses epoch milliseconds, and `~/.codex/history.jsonl` uses epoch seconds.

## The index

`~/.shadowclone/index.db`, opened with `bun:sqlite`.

It holds cursors, event skeletons, and tool call metadata. It holds no transcript text, because events carry pointers. It is a cache: deleting it costs one reingest and nothing else, and `06-roadmap.md` treats a schema change as a rebuild rather than a migration until the format settles.

Reporting is counts only. `indexed 4,182 events from 37 sessions` is a log line. Anything that would print captured content is not.

## Triggers

Three, arriving in this order, all reading the same cursors.

`shadowclone learn` on demand. This is the only trigger the first release needs.

A Claude Code `SessionEnd` hook, shipped in `.claude-plugin/`. Hooks receive `transcript_path` on stdin, so the hook ingests exactly one known file and never scans a directory. This is what makes shadowclone feel like it has no moving parts.

A long running daemon for people who want continuous learning and queued work. It adds no capability, only latency reduction, which is why it is last.
