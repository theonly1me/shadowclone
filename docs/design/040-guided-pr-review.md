# Guided review with human notes

## Problem

Humans need to understand more code as agents produce more pull requests. A file list does not explain related behaviour across a stack. Findings alone can also direct the human's attention before an independent review.

## Decision

Ship `guided-pr-review` as a portable skill. It produces one local HTML document with a shared reading route and PR filters for stacks. The reader sees one step at a time. Each explanation, diff, source excerpt, diagram, and proposed comment identifies its PR and pinned revision.

Git supplies the actual diffs and excerpts. The agent follows callers and state changes, writes the explanations, and records its investigation. The collector checks quoted evidence against committed code. A reasoned dry run stays distinct from an executed check.

Human notes attach to explanations, selected text, or code lines. Agent proposals use the same layout with a different author label. The human chooses when to reveal proposals and which notes to stage. Notes retain their original text and source references.

The standalone document provides annotation and export without Shadowclone. `shadowclone review open <report.html>` adds a local connection for users with the CLI. Opening the report makes no model request. A staging click authorizes the selected notes and PR.

The connected action uses the existing installed Claude Code or Codex engine. The model receives bounded excerpts for selected notes and related changes. It inspects the repository read-only and prepares comments. A separate operation checks current source anchors and creates an inline-only `PENDING` review. It does not use `publishReview`, which submits a `COMMENT` review.

The operation preserves existing drafts and manual edits. It saves private receipts before writes, recovers uncertain outcomes before retries, and verifies the returned draft. Unverified notes stay local with reasons. It creates no empty review and never submits feedback.

The browser connection listens on loopback and checks its origin and an ephemeral token. Notes and receipts remain in private user storage. The chosen provider receives selected notes, required code, and permitted voice guidance. Review data never becomes learning input.

Stage a separate content artifact named `@shadowclone/skills`. Keep the private workspace package and its runtime exports. Both the content artifact and the existing CLI bundle copy `skills/` from the repository root. The release workflow publishes each missing artifact independently with the existing product version.

PR metadata and CI stay in a disclosure. Notes and draft actions stay in a separate review panel.
Single-PR guides omit PR filters. Navigation disables unavailable steps.

## Sequence

1. Implement the portable report contract, evidence collector, renderer, and annotations.
2. Add the CLI connection, existing-engine dispatch, exact anchors, and pending reviews.
3. Verify source evidence, stack ownership, notes, action boundaries, and retry recovery with synthetic fixtures.
4. Stage the content artifact and verify manual selection and the existing installer.
5. Demonstrate the skill on the real mods PR and revise the article outside the checkout.
6. Update affected guides, run the full gate, and deliver one draft PR with green CI.

## Consequences

A shared document can explain a behaviour that spans several PRs. Per-change ownership prevents the shared guide from hiding which PR introduces a change. Git ancestry establishes inheritance. Unrelated PRs do not become a fabricated combined tree.

The skill adds browser controls without a frontend framework or remote assets. The CLI owns agent invocation and GitHub writes. The standalone artifact has no model or Shadowclone dependency.

The report can contain substantial repository code. Users must keep private reports outside public checkouts. The demonstration and article use actual public code, while tests use independently authored synthetic examples.

The bundled skill parser accepts the blank line that standard Markdown formatting adds after frontmatter.
It keeps the required H1 and workflow checks.

## Verification

Run portable scripts under Node and Bun. Use synthetic Git repositories for source ranges, renames, Markdown, binary files, and three-PR ancestry. Inspect the browser's reading order, dark theme, annotations, and evidence links.

Test the CLI through fake process and GitHub boundaries. Check pending-only payloads, current anchors, manual-draft preservation, empty selections, and uncertain-write recovery. Run the repository gate and inspect both npm artifacts before handoff.
