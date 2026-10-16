# Missing repository folders

## Problem

Setup and deep learning register each working repository folder, including a Codex worktree. Codex removes its worktrees later, but the registration stays.

`shadowclone sync` then stopped with "A registered repository identity changed or is blocked". The message named no folder, and no command removed the registration. Sync refreshed no learned skills and no native routing for any agent until someone edited `environment.json` by hand.

A second error had the same shape. "Every copy of a maintained skill is missing" named neither the skill nor its files.

## Decision

**Sync removes a registration whose folder no longer exists.** Before it synchronizes skills, sync checks each registered repository folder. If the folder does not exist, sync removes that registration. It also stops tracking the skills and instructions that shadowclone published inside that folder. Build artifacts stay, because a build owns them.

- Sync prints one line for each removed folder.
- Only a missing folder counts. A folder that exists but cannot be read stays registered, and its error stops sync.
- Another registration of the same repository, such as the main checkout, keeps its skills and routing.
- The removal is part of the sync revision, so `shadowclone undo` restores the registration.

Automatic learning runs the same synchronization, so it also removes these registrations. It prints nothing, but its revision records each removal. Without this step, each background run would fail until the user ran sync.

**Errors name what they are about.** The missing skill error names the skill and each missing file. The identity error names the folder. Learning that applies chosen keys does not run sync. If it reaches a missing folder, its error names the folder and says to run `shadowclone sync`.

## Consequences

A folder on a disconnected drive also counts as missing. Sync names it, and the next setup or deep learning in that folder registers it again.

Sync removes only records in `environment.json`. It deletes no file and changes no learned rule.

## Verification

Synthetic tests in `packages/environment` cover a deleted worktree next to a live checkout of the same repository, and a deleted folder that holds published skills. They also cover each error message, including the one from background learning.
