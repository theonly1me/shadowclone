# Skill Maintenance

## Summary

Shadowclone assesses skills in explicitly consented agent locations against the current scoped profile. It updates managed preference additions automatically, leaves user-owned changes pending for review, and creates local companion skills for third-party packages. It preserves original workflows and execution permissions.

## Problem

Native profile delivery does not keep task-specific skills aligned with later preferences. Installed skills have different ownership and scope, so rewriting every discovered file would discard user edits or change plugin packages. Routing descriptions and duplicate skills also need inspection.

## Prerequisites

Record 014 supplies native installation and scope-aware compilation.

Record 015 supplies durable learning, bounded execution, and local revisions.

## Design

The named skill-library source defaults off. Setup offers maintenance for standard personal or repository skill roots. Personal consent includes the selected agents' skill directories and plugin caches; repository consent includes only that repository's skill directories. Each recorded root carries scope, ownership, and a local companion destination. No skill contents or entry names are read before consent. Users can disable the source without removing their skills.

Discovery considers every SKILL.md within the consented roots without following symlinks, deduplicates canonical file identities, excludes Shadowclone's integration skill, and enforces file, depth, and total-byte bounds. Unsupported or malformed skills are reported without rewriting them. One assessment uses a small batch from one root and its matching compiled profile. Global roots receive global guidance only. Repository roots receive only the matching profile. A fingerprint cursor skips unchanged assessments and catches up in subsequent bounded runs.

The model selects exact supporting passages from the compiled profile, identifies routing, duplicate, conflict, and verification concerns, and proposes a preference addition with an optional routing description. Existing workflow bodies, supporting resources, optional frontmatter, and invocation policy remain intact. Automatic updates only replace a previously managed addition when the entire file still matches its recorded fingerprint and no unresolved validation concern exists. User-owned files require an explicit apply command. Plugin-cache files are immutable; approved suggestions create managed local companion skills that name the installed base skill without copying its scripts or assets. A user can explicitly adopt a skill for managed updates.

Validation requires valid YAML name and description fields, a bounded body, matching skill directory names, preserved invocation policy, balanced fences, and existing safe relative references. New technical commands, paths, and URLs are never invented by the updater: proposed additions consist of exact profile passages, and unsupported technical changes remain review findings. Routing description changes require review even for managed skills. The updater runs no discovered script and makes no documentation network calls. It verifies structural references, not the truth of arbitrary technical documentation.

The skills update command refreshes recent learning when deep consent permits, then assesses the discovered library. Automatic native-boundary maintenance uses the same worker and shares its total model allowance with profile learning. Pending changes can be listed, inspected, applied, or rejected. Source and target fingerprints are checked again at apply time. User changes are preserved, rejected identical suggestions stay rejected, and history and undo use the existing local revision system. Generated additions and companions remain identifiable so transfer evaluation can restore original user guidance and exclude generated skill content.

## Files

| Path | Change |
| --- | --- |
| `src/skillMaintenance/` | Consent roots, discovery, validation, assessment, proposals, and ownership |
| `src/cli/` | Maintenance setup and skill review commands |
| `src/config/` | Add the skill-library source, disabled by default |
| `src/learning/` | Share bounded execution with skill maintenance |
| `src/eval/transfer/` | Remove maintained additions from frozen baseline skills |

## Data handling

Only consented SKILL.md files are materialized. Each whole-file pointer reaches resolveRedacted before parsing for a model prompt. Supporting references are checked for existence and type but their contents are not read or executed. No arbitrary folder or transcript scan is introduced. Model prompts contain redacted skill documents and one compiler-projected profile scope. Raw file content is retained only locally for conflict detection and revision recovery. Proposal details pass through resolveRedacted before display. Root paths, ownership, hashes, and local review state never leave the machine. Forget removes maintenance state and owned companion files while preserving user-owned original skill content and stopping on conflicts.

## Alternatives

**Rewrite complete skills from sessions.** This mixes preference learning with unverified technical claims and risks deleting references, scripts, or user instructions.

**Update only package skills.** This leaves the user's actual skill library outside maintenance.

**Modify installed plugin caches.** Package updates can overwrite local edits and ownership is ambiguous. Companion skills remain local and separate.

## Accepted costs

Technical correctness beyond syntax and reference integrity still requires review. Duplicate or conflicting skills receive findings instead of automatic deletion or merging. Discovery is bounded and fails with an explicit diagnostic when a configured library exceeds its limits. Assessments may require multiple bounded runs for a large library. Companion skill selection still depends on the host agent's skill discovery.

## Testing

Fixtures cover disabled consent, root and repository isolation, symlinks, malformed frontmatter, unresolved references, duplicate names, generated-file edits, pending review, plugin immutability, conflicting apply, persistent rejection, undo, and shared execution limits. An actual redaction bypass must fail the planted-secret assessment test before restoration. Transfer isolation must recover the original skill bytes after a maintained update. The full repository gate and build run before commit.

Validation: replacing the discovery gate with raw file text made the planted-secret assessment test fail; restoring resolveRedacted passed. Generated skill metadata, invocation settings, code fences, and original-byte recovery have executable fixtures. The optional skill-authoring Python validator could not run because PyYAML is absent. Authenticated model quality and provider discovery remain manual checks.

## Open questions

None.

## Decision record

Assess all discovered skills within explicitly consented roots.

Preserve existing workflows and use exact compiled preferences for additions.

Require review for user-owned changes and routing changes.

Keep plugin packages immutable and use local companion skills.

Share the learning worker's model allowance and persist review decisions.
