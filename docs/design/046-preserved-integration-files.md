# Preserved integration files

## Problem

`shadowclone sync` keeps an integration file when its shadowclone content changed after shadowclone wrote it. On one real machine, sync kept the files of three agents and exited with status 1. For each agent, it printed the agent folder and said that the folder was a symbolic link. The real files and reasons were different, and no command took the new routing.

Two of the three reports were false. Antigravity had rewritten its `hooks.json` with sorted keys, and shadowclone compared hooks as JSON text. The Codex and Pi sections held shadowclone's own text with an older recorded fingerprint. Session start reads the integration record, does slower work, and then saves that whole copy with a new `deliveredAt`. If sync saves a new fingerprint during that time, session start restores the old fingerprint.

## Decision

**Report the real file and reason.** A preserved file throws `PreservedFileError` with the reason and the file path. Sync reports it as a preserved entry, separate from a linked file. The CLI names the file and the reason, and says how to take the new routing.

**Replace on request.** `shadowclone sync --replace-edited` replaces only the content that shadowclone owns: the guidance section, the shadowclone hooks, and the integration skill or extension. The rest of each file stays. Sync names each replaced file, and its revision lets `shadowclone undo` restore the edit. A hook file that is not valid JSON stays preserved.

**Stop the false reports.** Hook entries match by value, whatever the key order. Session start reads the current record again and sets only `deliveredAt`.

## Consequences

Sync still exits with status 1 when it keeps a file, so a script sees the skipped agent. The option replaces text that a person may have written inside the guidance markers. The report names each file, and undo restores it.

## Verification

Synthetic tests cover the preserved report, the replacement and its undo, and a hook file with sorted keys. Another test saves a record while session start runs. A CLI test checks the printed lines.
