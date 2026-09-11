# Privacy and data flow

The maintained public statement is [Data handling](../data-handling.md). This page records the implementation boundaries.

## Consent and eligible evidence

Source contents are read only after the corresponding source is enabled. Onboarding uses a boolean presence check to decide which consent questions to show. Git metadata, repository guidance, and evaluation context each have separate consent.

Learning uses eligible user prompts, correction context, and event metadata. Tool-result payloads and thinking blocks are excluded from learning. Parsing an enabled transcript can encounter their bytes; this is not a claim that all sensitive third-party content is absent from eligible prompts.

## Materialization

The index carries metadata and pointers. The redaction module validates bounded references against authorized roots and applies the existing pattern replacer when selected content is materialized. Explicit context imports and profile compilation use the same bounded snapshot service. Raw profile metadata and redacted visible content come from one read.

Redaction is pattern-based and can miss sensitive data or remove harmless text. It is not comprehensive secret or personal-data detection. Repository content observed during evaluation and approved remote-action drafts also require care because they may contain sensitive information.

## Storage and reports

Generated local data uses private directories and owner-only files. SQLite stores the event index; Markdown stores editable guidance. Evaluation `state.json` contains private frozen inputs and derived content for resume. `budget.json` records cumulative usage. Reduced `report.json` and JSON CLI output exclude private prompts, profile bodies, evidence excerpts, and absolute paths.

Whole transcripts are not copied into the index. Selected and derived content can persist in profile, checkpoint, and evaluation files. These files are not encrypted. Temporary snapshots are removed on handled completion or failure; abrupt termination can leave residue.

## Deletion

`shadowclone forget --all` removes Shadowclone state and attempts cleanup of recorded, matching installed artifacts. It deletes local task worktrees, so unfinished work must be preserved first. Source transcripts, provider data, remote GitHub activity, backups, and Git history remain. Modified or unverifiable installed files are preserved. `shadowclone uninstall` handles the current repository without deleting unrelated agent files.

There is no source-specific or repository-specific forget command and no automatic retention expiry. Disabling capture does not erase existing profile rules. The data-handling statement explains how to inspect and correct them.
