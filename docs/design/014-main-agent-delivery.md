# Main Agent Delivery

## Summary

Shadowclone installs the shared compiled profile into the main Claude Code, Codex, and Cursor agent. Installation supports personal global defaults and repository guidance, preserves existing files, and keeps subagents optional.

## Problem

The public installer writes only a Claude subagent. The Claude plugin can inject main-agent context, but installation does not offer that experience across supported agents or maintain native guidance after profile changes.

## Prerequisites

Record 013 supplies the deterministic compiler and legacy installation lifecycle.

## Design

Native integration records live separately from the version-one subagent manifest so existing installations remain readable. Each record identifies the agent, installation scope, destination directory, owned artifact fingerprints, and owned Git excludes. Native instruction files contain a bounded managed section. Updates and uninstall preserve surrounding text and refuse to overwrite edited managed sections. Hook configuration merges only the installer-owned entries and preserves unrelated settings.

Claude uses CLAUDE.local.md in a repository and personal CLAUDE.md globally. Codex uses AGENTS.md in either scope, honoring its configured home. Cursor repositories use a dedicated always-applied rule. Cursor global delivery uses its user session-start hook because the CLI does not document a global instruction Markdown file. All agents receive a small integration skill and lifecycle hooks. The compiler accepts an explicit global-only or scoped-only selection without introducing another projection.

Session-start hooks resolve the active repository and prefer its installation over a global installation of the same agent. Native files carry the last compiled guidance. Global hooks add only scoped guidance; Cursor global hooks supply the complete compilation. A repository hook supplies fresh guidance only when the stored native compilation is stale. Hook receipts prove delivery execution, not model adherence. Session-end refresh recompiles approved guidance without making a model call.

Setup offers installation after existing profile and source choices. The install command accepts agent and scope selection, retains an explicit subagent option, and leaves legacy programmatic installation behavior available. A context command exposes the same compiler for agents using the CLI. Profile-changing public commands refresh recorded destinations, and doctor reports missing, edited, stale, or unobserved integrations. Uninstall and forget remove owned content only.

## Files

| Path | Change |
| --- | --- |
| `src/cli/` | Wire setup, installation, context, hooks, refresh, doctor, and cleanup |
| `src/profile/compiler/` | Select global, scoped, or combined guidance through the existing compiler |
| `README.md` | Document the main-agent workflow and compatibility |

## Data handling

Installation reads only the selected destination files to preserve their contents, and stores paths and fingerprints in the local installation manifest. Existing file contents do not enter learning or logs. Profile guidance reaches output only through compileProfile and its resolveRedacted gate. No transcript source is enabled by installation. Hook input text is not captured. Repository scoping continues to require independent Git metadata consent. Managed policy blocks delivery for disabled or excluded repositories.

## Alternatives

**Require an MCP call for every session.** Native loading makes essential guidance available without requiring the model to discover a tool.

**Replace instruction files.** Managed sections preserve the user's instructions and detect edits to generated content.

## Accepted costs

Native hooks require a provider version supporting the documented lifecycle format. Cursor global delivery depends on its session-start hook. Existing running sessions may retain their previously loaded native guidance. Provider installation and authenticated session delivery require manual verification in addition to fixture tests.

## Testing

Tests cover all destination shapes, global scope isolation, edited block preservation, exact restoration of surrounding text, unrelated hook preservation, repeated installation, refresh after profile changes, and uninstall. Hook tests prove repository selection and provider response formats. A planted profile secret proves the compiler gate by temporarily bypassing resolveRedacted and observing the regression assertion fail. The repository check and executable build run before the PR is presented.

Transfer evaluation removes bounded generated sections from frozen user instructions while preserving their authored text. Snapshot isolation removes native integration skills and hook configuration before recording the starting commit. The baseline and profiled arms keep identical original guidance, native discovery remains disabled, and installation behavior is verified separately through adapter tests. Unmanaged historical profile injection still fails isolation explicitly.

Verification passed the full repository check with 339 tests and 1,691 assertions. The 345 KB executable builds and its help matches the source CLI. Bypassing resolveRedacted in the compiler made the native-install planted-secret test fail on the exposed fixture key; restoring the gate made it pass. Native installation and context output add no model call. Model-facing strings originate at the compiler gate, while local destination preservation and evaluation snapshot cleanup do not send their input anywhere.

## Open questions

None.

## Decision record

Keep one profile compiler and expose explicit scope selection.

Use native instructions and lifecycle hooks for main-agent delivery.

Track native integrations independently of legacy subagent installations.

Preserve manual changes and remove only installer-owned content.
