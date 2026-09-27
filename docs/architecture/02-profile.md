# Learning and skill delivery

Shadowclone stores durable learning internally and publishes it into portable skills. Native `CLAUDE.md` and `AGENTS.md` sections require a baseline skill and route tasks to matching workflows. Session hooks, MCP, optional subagents, and dispatch share that delivery. Active environments do not compile a separate Markdown profile.

## Evidence

`~/.shadowclone/environment.json` is a versioned, readable record of guidance, scope, supporting observations, source hashes, rejections, publication destinations, and pending decisions. It retains complete learning independently of a startup budget. Local revisions preserve previous records and files.

The capture index remains a disposable SQLite store of pointers and event skeletons. Eligible user steering passes through the redaction gate before reconciliation. Tool results, file contents returned by tools, thinking, and other data-access results remain excluded. Explicit durable guidance can activate after one session; inferred behavior needs three independent sessions. Additional context, temporary exceptions, bare interruptions, and refusals do not independently justify a preference.

Plain `shadowclone learn` reports structural evidence without model calls. `learn --deep` reconciles evidence and requests application unless `--apply` was supplied. Automatic learning remains separately consented and bounded. Pending publication survives completed capture batches, so an unchanged transcript need not be processed again to finish a skill update.

`remember` records an explicit preference without inference. Publication happens through the learning and skill-maintenance pipeline. A recorded preference is not proof that its skill has already been published; `skills pending` and `context --explain` report that distinction.

## Skills

The planner reviews the consented library's metadata, then reads the selected skill's complete redacted instructions. It selects a matching workflow before creating a new one. Drafts use exact section edits for existing skills. Unrelated instructions, frontmatter invocation settings, supporting files, and conditional exceptions are preserved. New skills contain only supported instructions and cannot invent resource paths.

Universal guidance belongs in `shadowclone-baseline`. Workflow procedures, preferences, prerequisites, and examples belong in the relevant task skill. Necessary short standalone facts can appear in scoped native context. Temporary task state receives an explicit exclusion. Baseline and native sections each have a 4 KiB ceiling; other skills retain the 48 KB and 500-line limits. Overflow remains visible and evidence is not truncated to make publication fit.

Source access and automatic maintenance are separate permissions. With automatic maintenance enabled, supported changes to user-owned skills apply through reversible file transactions. Conflicting evidence, divergent copies, ambiguous edits, invalid resources, and uncertain technical changes remain pending. Third-party packages stay unchanged and receive local companion guidance tied to selection of the original skill.

Global output contains only global learning. Project output requires an explicitly registered repository with a matching Git identity; organization learning remains within its owner. Imports stay as evidence and do not become duplicated behavioral delivery. Learning for unregistered repositories remains stored until the original repository is registered.

## Portable files

Global skills use `~/.agents/skills` as the canonical directory. Claude and Antigravity receive complete copies; Codex and Cursor discover the canonical directory. Repository skills use `.agents/skills` and `.claude/skills` under the registered root. Supporting resource copies preserve bytes and executable permissions. Symbolic links, conflicting resources, and publication that exceeds the reversible revision budget stop that update.

Skill files, native sections, resources, and the publication record are one revision. File fingerprints detect concurrent edits; a failed write rolls back completed writes. Undo refuses subsequent conflicting edits. Synchronization can propagate a single manual edit and preserves divergent edits for reconciliation.

## Memory

The default-off `claude-memory` source permits reading memory only for registered, verified repositories during learning. Extraction hashes each note, uses the existing redaction boundary, and reconciles durable guidance into skills or scoped facts. Repeated unchanged notes do not create new evidence. Existing migrated notes retain their identities. Native memory is never written, deleted, or restored.

## Migration and compatibility

`migrate skills` previews retained learning and repository coverage without writing or invoking a model. Apply freezes original skills and consented native instructions, retains legacy guidance and references internally, and publishes supported changes in bounded batches. Each completed batch can be undone. The original baseline is reused on resume.

`--automatic` authorizes supported skill editing. `--memory` enables recurring extraction. `--apply --activate-only` switches native delivery without another model call, after all applicable learning has a publication or explicit disposition, the baseline exists, and published fingerprints match. Unknown repository scopes remain visible and cannot leak into another project.

Legacy Markdown files under `~/.shadowclone/profile/` remain recovery artifacts after migration. Unmigrated installations and historical evaluation receipts keep their original compiler behavior. Legacy profile repair and one-time memory migration do not modify an active skill environment.

The `shadowclone_context` MCP tool returns current scoped routing. `shadowclone_profile` is a deprecated alias. `context --explain` reports skills, facts, evidence, and publication decisions. `skills pending`, `retry`, `exclude`, `history`, and `undo` provide local maintenance and recovery.

## Evaluation

The skills protocol compares bare, original skills, original skills with native memory, and maintained skills with native routing. Original and maintained libraries are frozen separately. The maintained condition receives no profile overlay. See [evaluation](09-evaluation.md); successful publication does not establish improvement.
