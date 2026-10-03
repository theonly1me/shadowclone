# Privacy

Shadowclone runs on your machine. It does not operate a collection service and does not add telemetry.

## What it reads

Each session, memory, repository, and skill source is disabled until you consent to that source. Setup asks separately about session learning, skill maintenance, and background learning. You can use the browser build editor without enabling learning.

Shadowclone excludes tool results, tool-returned file contents, thinking blocks, and data-access results from learning. It resolves eligible text through its redaction boundary before model work. Redaction reduces exposure but does not guarantee anonymity, so use only material you are authorized to send.

## What leaves your machine

Opening the browser editor and using the local MCP server do not send data to Shadowclone. Optional learning, skill drafting, and build descriptions use an agent CLI you choose. Consented, redacted inputs go directly through that provider and are governed by its terms.

The build description action sends selected skill titles and redacted summaries. It does not send skill bodies, file paths, repository names, or ownership metadata.

## Local storage and removal

Configuration, evidence, revisions, generated skills, and installation records stay in Shadowclone's local state directory or in files you review before applying. Disable background learning with `shadowclone learning disable`, stop automatic skill edits with `shadowclone skills automatic off`, or remove recorded state with `shadowclone forget --all`.

Uninstalling the plugin removes its packaged setup workflow. Use the CLI removal commands for locally installed guidance and state.

## Questions and reports

Use [GitHub issues](https://github.com/theonly1me/shadowclone/issues) for privacy questions that contain no sensitive data. Follow [the security policy](SECURITY.md) when a report needs private material.
