# Draft review boundary

Use this only after the human selects notes and requests draft staging. The installed Shadowclone CLI provides the connected button. Standalone notes remain local.

Use the user's configured personal review guidance when available. It can define voice, review judgment, and draft rules. Do not copy a personal skill or voice profile into a shipped skill.

1. Confirm the selected PRs, notes, and authorized GitHub identity.
2. Read current PR state, head, base, conversation, and any existing pending review.
3. If a revision changed, inspect affected behaviour before rebuilding anchors.
4. Review the rough notes, preserve their intent, and prepare concise wording in the user's voice.
5. Verify every asserted claim against code and relevant callers.
6. Match each comment to actual current diff lines and the correct PR.
7. Keep notes without a meaningful anchor local, with a specific reason.
8. Preserve manual drafts and edits. Recover interrupted writes before retrying.
9. Create inline-only pending reviews.
10. Read back the account, commit, PENDING state, comments, and anchors.
11. Return the actual draft link and exact staged and unstaged counts.

Create-review requests omit `event` and the top-level `body`. They contain the pinned `commit_id` and a nonempty inline `comments` array. Use source `line` and `side` fields, never an assumed diff position.

Never submit a review, approve, request changes, reply to a thread, or create a conversation comment. The human edits and submits the draft in GitHub.

A lost response does not prove failure. Read existing pending feedback before another write. If a manual draft prevents safe staging, preserve it and return the prepared comments locally.

Selected notes and relevant code reach the chosen coding-agent provider. Notes, receipts, and review output are not learning input. Keep them outside the public checkout.
