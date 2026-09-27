# Move an existing installation to skills

Older installations deliver a compiled Markdown profile. Migration keeps that learning, saves the original skill library, and publishes supported guidance into skills and native instructions. Native memory is never modified.

New installations already use the skills environment.

## Preview

Run from a repository whose scoped learning you want to retain:

```bash
shadowclone migrate skills --repo /path/to/repository
```

Preview reads local state without writing or calling a model. Repeat `--repo` to register additional repositories. Without that option, the current directory is used. Learning for an unregistered repository remains stored but cannot be published there.

## Publish

```bash
shadowclone migrate skills --apply --automatic --memory --repo /path/to/repository
```

`--automatic` authorizes supported edits to user-owned skills. `--memory` enables recurring read-only extraction from Claude memory for registered repositories. Omit either flag to retain its current setting.

Apply saves the original library and native instructions, then publishes in reversible batches. It uses the authenticated agent CLI and the learning budget. Repeat the command to continue; completed work and the original baseline are retained.

Inspect anything that remains unpublished:

```bash
shadowclone skills pending
```

Resolve conflicting edits before retrying a learning record. Use `skills retry <key>` to queue it for the next update, or `skills exclude <key> <reason>` to record a deliberate exclusion. Run `shadowclone skills update` to process pending work when maintenance consent allows it.

## Activate

```bash
shadowclone migrate skills --apply --activate-only
shadowclone context --explain
```

Activation makes no new model call. It requires coverage for applicable learning, a published baseline, and matching file fingerprints. Unresolved registered scopes or changed files prevent the switch.

Legacy profile files remain recovery artifacts after activation. Use `history` and `undo <revision>` to inspect and reverse recorded changes. Undo refuses to overwrite intervening edits.

## Before migration

The compatibility commands below operate on profile-based installations:

| Command | Purpose |
| --- | --- |
| `shadowclone profile repair` | Preview profile repairs; `--decisions <file>` supplies reviewed choices and `--apply` writes them |
| `shadowclone migrate claude-memory` | Preview the older one-time memory import; reviewed decisions and apply are explicit |
| `shadowclone skills show <id>` | Inspect a legacy skill proposal |
| `shadowclone skills apply <id>` | Apply a reviewed legacy proposal |
| `shadowclone skills reject <id>` | Reject a legacy proposal |
| `shadowclone skills manage <skill-id>` | Authorize legacy managed additions for a skill |

After migration, use the [skill maintenance](../README.md#maintain-your-skills) controls. Historical evaluation receipts keep their original profile meaning and are not converted into skills results.
