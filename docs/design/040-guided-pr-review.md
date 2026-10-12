# Guided review as a portable skill

## Problem

A human needs a reading route through related changes, actual diffs, and a way to question the review.
The first implementation added a local application and staging pipeline before establishing that reading experience.

## Decision

Ship guided-pr-review as a portable skill with a small self-contained HTML document.
Use shadowclone-review locally for investigation. The guide adds explanations, related code, state traces, and human annotations.
Generating or opening it makes no GitHub review write. Read CI results and avoid repeating its routine checks.

Group every changed file into the reading route or an explained supporting group.
Expose each actual diff and label its PR. Use combined views only when Git ancestry establishes a stack.
Keep findings hidden until the human chooses comparison. Each visual and claim links to pinned evidence.

Start with the main definitions and their signatures, then follow their callers and effects.
Pair each passage with its related diffs. Put supporting changes after that part of the story.
Expand every file by default. The findings button opens the findings list immediately.
Each file link opens that file's diff on GitHub.

Read Git paths literally and disable diff colors when collecting evidence.
An open note keeps its selected code and draft until the human saves or cancels it.
Closing a source view, including Escape, returns its note to the visible document.

The human selects prose or code to leave a rough comment.
Chrome or Edge writes annotations into the original HTML after the human selects that file and grants permission.
The document reports a saved state only after the write completes. It preserves unsaved notes after a failure.
The saved file contains the facts, findings, and annotations needed by another agent.

The human attaches that HTML to a chat and requests staging.
The host agent follows the user's own staging workflow, resolves current anchors, and respects posting preferences.
Personal staging skills and voice evidence stay outside the public package.

Reuse the existing review engine and its local output. Add no runtime dependency or agent handoff API.

Stage a separate @shadowclone/skills content artifact from root skills.
The CLI continues to bundle the same content. Workspace runtime packages stay private.

## Sequence

1. Remove the application runtime and keep the portable content path.
2. Build the reading template, actual diffs, selection comments, and same-file saving.
3. Verify one real reading step and a save and reopen cycle before completing the demonstration.
4. Account for the complete PR and update the article from actual results.
5. Verify packaging and deliver the smaller draft PR with green CI.

## Consequences

The guide works without the shadowclone CLI. An installed local coding agent performs investigation and authorized staging.
Reading works in ordinary browsers. Same-file saving requires supported browser file access and explicit permission.
A missing permission cannot silently become a downloaded copy or a claim that the original file changed.
Private reports and annotations stay outside public checkouts.

## Verification

Use synthetic Git fixtures for actual diffs, source ranges, stack ownership, Markdown, and complete coverage.
Verify selection comments and same-file saving in a supported browser, then inspect that saved HTML as an agent.
Check the portable scripts, personal routing separately, both staged npm artifacts, and the repository gate.
Check definition order, inline signatures, expanded files, the findings panel, and exact GitHub file links.
Check route filenames, forced Git colors, selection changes during a draft, and Escape from the source view.
