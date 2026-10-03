# Capture and indexing

Capture reads enabled sources and normalizes them into events. The [source inventory](../data-handling.md#sources) lists locations and consent settings. Definitions live in `src/config/schema.ts`; adapters live in `src/observe/`.

## Consent and discovery

Before consent, setup can check whether a configured root exists and is non-empty. Directory checks read at most one entry, reduce the result to a boolean, and close the directory. They do not open source contents or retain entry names and metadata.

After consent, repository instruction import accepts the three supported root instruction files and direct skill documents. It rejects symlinks and enforces file and byte limits before materializing content. Git remote discovery has separate consent; without it, working directories remain isolated.

A new source, a wider slice of a file, or reading contents where only names were read requires a named, default-off source setting.

## Events and text references

`AgentEvent` records source, session and event identity, ordering, timestamp, working directory, kind, tool metadata, and an optional `TextRef`. See `src/observe/types.ts` for the types.

The event index does not contain transcript text. A file reference selects a bounded byte range. A Cursor reference selects a text field in a content-addressed SQLite blob. `resolveRedacted` checks the reference and redacts the selected text before it becomes learning input.

Parsers can encounter every record category in an enabled transcript. Tool-result payloads, tool-returned file contents, thinking blocks, and data-access results do not receive eligible learning references. User steering and limited assistant context can be used to understand a correction.

## Incremental reads

JSONL cursors track source size, modification time, and the last complete byte offset. Appends are read from that offset. Truncation, rewrites, and invalid boundaries cause a rescan. A partial trailing line waits for a later invocation.

Reads and materialization are bounded. Oversized records or databases are skipped with diagnostics; limits are defined in the implementation. SQLite chat sources are rescanned when their database, write-ahead log, or metadata changes.

The index also records observed source/session/repository bindings. Schema rebuilding preserves known bindings, but deleting the database loses them. Unknown historical identity stays isolated.

## Adapter distinctions

| Source | Parsing concern |
| --- | --- |
| Claude Code | Multiple assistant blocks can share a message identity; tool results can arrive as user records; injected metadata is not user-authored guidance |
| Codex | Message and event streams can describe the same turn; adapters avoid counting both |
| Pi | Version 3 JSONL entries retain parent links; each correction uses its own ancestor context, with tools, thinking, injected messages, and summaries excluded |
| Cursor | Chat databases contain both JSON messages and opaque blobs; only supported records are interpreted |
| Antigravity | Generated logs provide conversation records and cancellation signals; capture does not query a live daemon or write plaintext sidecars |
| Shell | Commands are grouped as prompts but do not provide the preceding agent context needed for correction signals |

Claude subagent transcripts are discovered separately from parent files. Provider-specific interruption markers have no stable schema guarantee, so marker-health diagnostics report suspicious gaps. Adapters normalize timestamps before derivation.

## Learning triggers

Plain `learn` indexes and reports structural evidence. Deep learning resolves eligible references and reconciles durable guidance. Consented setup can perform a bounded first pass.

Native integrations issue an opaque session token when automatic learning is enabled. The agent marks a session useful when it contains reusable steering; the end hook can then schedule a bounded worker. A stop alone does not authorize learning. The worker selects unprocessed evidence for the requested session and records progress for later runs.

The Claude plugin’s transcript hook validates its supplied path, checks consent and policy, and ingests that file through the shared cursor. It does not turn arbitrary transcript content into rules. No always-on daemon is required.

## Verification

Adapter tests must exercise the real entry point with synthetic secrets and excluded record categories. Test appends, rewrites, incomplete records, duplicate provider views, and changed source references. Logs should expose counts and source names without captured text or identifying paths.
