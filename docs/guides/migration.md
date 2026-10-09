# Move an existing installation to skills

Older installations deliver a compiled Markdown profile. Migration keeps that learning and saves your original skill library. Then it publishes the supported guidance into skills and native instructions. It never changes native memory. New installations already use skills, so they need no migration.

## Preview

Run this command from a repository whose scoped learning you want to keep:

```bash
shadowclone migrate skills --repo /path/to/repository
```

The preview reads local state. It writes nothing and calls no model. Repeat `--repo` to register more repositories. Without the option, the command uses the current directory. Learning for a repository that you do not register stays stored, but Shadowclone cannot publish it there.

## Publish

```bash
shadowclone migrate skills --apply --automatic --memory --repo /path/to/repository
```

- `--automatic` authorizes supported edits to the skills that you own.
- `--memory` turns on recurring read-only extraction from Claude memory for the registered repositories.
- If you omit a flag, its current setting stays.

Apply saves the original library and native instructions. Then it publishes in batches that you can reverse. It uses the authenticated agent CLI and the learning budget. Repeat the command to continue. Completed work and the original baseline stay.

Inspect anything that remains unpublished:

```bash
shadowclone skills pending
```

Resolve conflicting edits before you try a learning record again. Run `skills retry <key>` to queue a record for the next update. Run `skills exclude <key> <reason>` to record a deliberate exclusion. Run `shadowclone skills update` to process pending work when your maintenance consent allows it.

## Activate

```bash
shadowclone migrate skills --apply --activate-only
shadowclone context --explain
```

Activation makes no new model call. It needs coverage for the applicable learning, a published baseline, and matching file fingerprints. An unresolved registered scope or a changed file stops the switch.

The legacy profile files stay as recovery files after activation. Use `history` and `undo <revision>` to inspect and reverse recorded changes. Undo refuses to overwrite later edits.

## Before migration

These compatibility commands work on installations that still use a profile:

| Command                                | Purpose                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `shadowclone profile repair`           | Preview profile repairs. `--decisions <file>` supplies reviewed choices, and `--apply` writes them. |
| `shadowclone migrate claude-memory`    | Preview the older one-time memory import. Reviewed decisions and apply are explicit.                |
| `shadowclone skills show <id>`         | Inspect a legacy skill proposal                                                                     |
| `shadowclone skills apply <id>`        | Apply a reviewed legacy proposal                                                                    |
| `shadowclone skills reject <id>`       | Reject a legacy proposal                                                                            |
| `shadowclone skills manage <skill-id>` | Authorize legacy managed additions for a skill                                                      |

After migration, use the controls in [skill maintenance](skills.md).
