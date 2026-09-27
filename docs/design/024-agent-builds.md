# Agent builds

## Problem

The terminal wizard exposed choices without a persistent visual editor, and a selected preference could remain unpublished until learning ran. Two related defects affected publication: concurrent calls could each receive the same unspent dollar allowance, and a repository refresh could erase checks when profile prose became skill routing.

## Decision

Provide one editable build per scope through shared preview and apply operations. The browser wizard opens with `shadowclone wizard`; `--cli` selects the terminal interface. Both publish the same portable skills, native instructions, and reversible revisions.

Users can equip bundled or consented existing skills, edit user-owned instructions, and create custom skills. Selecting preferences publishes them immediately. Global builds provide personal defaults; repository builds refine them without weakening shared requirements. Provider-owned packages stay read-only, with reviewed personal changes in local companions.

Private repository output stays untracked. Shared output contains explicitly reviewed portable content and relative paths. Preview fingerprints prevent overwriting intervening edits. Native providers may still discover a global skill omitted from repository routing, so the editor must distinguish routing from activation.

Show every skill in the tree, with search, accessible controls, a detail editor, and review before apply. Individual stars drift, twinkle, and fade independently without restarting when a skill changes. Ambient lighting stays consistent; each equipped skill keeps its own illumination. The live build summary remains beside the tree. Short descriptions explain behavior while full instructions remain editable. Assets ship locally, and motion respects reduced-motion preferences. Optional model-written descriptions explain a build but never become injected instructions.

The creation dialog offers Use AI alongside manual editing. It sends only the current form fields after reviewing the redacted payload, destination, and limits. Generated names, triggers, and instructions remain an editable draft until the user adds the skill and reviews publication. Failures and cancellation preserve the original fields. Both model actions share bounded no-tools execution and reject duplicate submissions.

Every dialog supports an explicit close control, Escape, and clicking its backdrop. Dismissing a generation request aborts it and preserves the current form. Provider failures show their bounded, redacted diagnostic so the user can distinguish authentication, usage limits, and provider errors without guessing.

Browser model output uses JSON Schema Draft 7, matching the supported Claude CLI contract. Zod's default Draft 2020-12 declaration is rejected locally before a model request.

## Budget and check preservation

Fix shared budget accounting before relying on it for editor model calls. Serialize calls sharing a dollar cap, calculate the allowance at dispatch, and stop further calls after unknown spend. Preserve explicit repository checks during refresh; changing them requires review.

## Data handling

Bind the browser server to loopback, authenticate its API with an ephemeral token, and validate origins. Opening the editor enables neither capture nor model access. Existing skill reads require consent; editing authorizes only reviewed writes. Accept validated domain operations, never arbitrary file paths or shell commands.

Show the payload and destination before optional bounded model descriptions or skill drafts. Form drafting reads no repository files and adds no capture consent. Keep private evidence and identifying paths outside the public checkout and package. Native memory remains read-only.

## Verification

Cover shared-budget exhaustion and unknown costs, check preservation, immediate preference delivery, terminal and browser parity, scope, conflicts, undo, and unauthorized requests. Exercise the local browser and a relocated packed installation. Behavioral evaluations remain separate from synthetic packaging and interface checks.

The comment check must use parsed token boundaries so interpolated local URLs are treated as strings while comments inside interpolation expressions remain violations.

Packaged browser routes serve only files from the generated asset manifest, resolved beside the installed bundle. Public asset URLs retain their relative layout. Launching the CLI from a work repository must not make asset lookup depend on that repository's working directory.
