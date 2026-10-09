# Privacy

Shadowclone runs on your machine. It does not operate a collection service and does not add telemetry.

## What it reads

Each session, memory, repository, and skill source is off until you consent to that source. Setup asks about session learning, skill maintenance, and background learning in three separate questions. You can use the browser wizard without learning.

Learning excludes tool results, tool-returned file contents, thinking blocks, and data-access results. Shadowclone passes eligible text through its redaction boundary before any model work. Redaction reduces exposure. It does not guarantee anonymity, so send only material that you have the right to send.

## What leaves your machine

Opening the browser wizard and using the local MCP server send no data to Shadowclone. These features send data to a model provider that you choose:

- **Learning and skill maintenance.** Selected redacted instructions, steering, and supporting context go to your agent CLI.
- **Build naming.** The wizard sends the titles and redacted summaries of the skills that you equip. It sends no skill bodies, file paths, repository names, or ownership data.
- **Voice capture.** You turn on the `github-writing` source in the wizard. Shadowclone reads text that you wrote, through your `gh` login. It redacts the text, limits its size, and sends it to your learning model once to describe your voice. Saving writes `~/.agents/voice.md` only if no file exists there.
- **Pull request review.** A local review sends Claude Code the pull request text, the diff, file history, repository standards, rule hits, diagnostics, and files that the reviewer reads. It can search the web and fetch documentation pages. It sends the package names and versions of a changed lockfile to the OSV API. `--offline` turns off both.
- **Cloud bot.** The bot sends your reviewed skills, the repository, and the task to the provider of the token that you add. Shadowclone never reads your tokens. You enter them on GitHub, where they stay as environment secrets.

The provider governs the retention of each request. GitHub governs the retention of cloud runs and repository content.

## Local storage and removal

Configuration, evidence, revisions, generated skills, and installation records stay in the local state folder of Shadowclone. They can also stay in files that you review before you apply them. These commands remove data:

- `shadowclone learning disable` stops background learning.
- `shadowclone skills automatic off` stops automatic skill edits.
- `shadowclone forget --all` removes the recorded state.

Uninstalling the plugin removes its setup workflow. Use the CLI removal commands for locally installed guidance and state. [Data handling](docs/data-handling.md) lists every source, request, and file.

## Questions and reports

Use [GitHub issues](https://github.com/theonly1me/shadowclone/issues) for privacy questions that hold no sensitive data. If a report needs private material, follow the [security policy](SECURITY.md).
