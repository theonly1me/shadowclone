# Repository harness

## Summary

Shadowclone builds and maintains the repository harness that lets coding agents do engineering work the way the owner would supervise it: a short `AGENTS.md` map, the owner's skills with mandatory triggers, one verification gate, mechanical conventions whose failures explain the fix, and a feature workflow with explicit approval boundaries. The harness is generated from the owner's learned profile and the repository's own facts, enforced through `shadowclone harness check` and a Claude Stop hook, and kept current from later corrections through `shadowclone harness sync`. Startup context from native hooks shrinks to a deduplicated 4 KiB index, and headless runs commit only when the gate passes.

## Problem

This repository was built entirely by coding agents because its owner maintained a harness by hand: a navigational `CLAUDE.md`, skills such as `clean-code` and `scoped-fix`, `scripts/conventions.ts` plus Biome rules, one gate (`bun run check`) that CI runs, design records, and a PR template. Corrections were folded back into those files manually. Shadowclone did not reproduce any of that for another repository. It injected a profile instead, and that delivery made agents worse.

Default setup imported the repository's `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and skill bodies as rules that ranked ahead of learned guidance. The session-start hook re-injected them, with skill triggers removed, under a 16 KiB budget whose tie-break was a random key, so learned rules were dropped. A native probe during record 021 showed that a 16,255-byte SessionStart packet reached Claude with zero complete copies. Every session also carried a `learn --session` instruction, the instruction pointer called the profile advisory, plugin and native hooks could both inject, and portable skill copies appeared several times in agents that read more than one skill root. The removed `migrate claude-memory --archive-source` command deleted notes from native Claude memory, after which the owner observed Claude ignoring skills.

Record 021 measured adherence with native skills and Claude memory present: Shadowclone matched or trailed Claude memory on preferences and exceeded it only on shared-memory knowledge. Learning produces one-line rules and skill maintenance appends passages, so neither represents a workflow. The learning-to-next-task loop was never measured.

## Prerequisites

Record 013 supplies the single profile compiler; without it the harness would need a second projection.

Record 014 supplies managed native sections and hook ownership; without them harness writes could clobber user text.

Record 015 supplies local revisions and undo; without them harness writes would not be reversible.

Record 021 supplies the reference library and the native delivery probe that established the size limit.

## Design

**Startup context.** Native hooks and the Claude plugin deliver one line per active rule through a new `index` format of `compileProfile`: the title, the body's first sentence when it is short and has no code fence, and the rule's conditions. The index is capped at 4,096 bytes with whole lines only. Imported repository guidance is omitted as `native-duplicate`, as record 021 already implemented. References are not listed at startup; when any exist for the main agent, one line points to `shadowclone recall <query>`, and the MCP tool retrieves the same records. Under `declared-rules` consent, the hook reads the working directory's `CLAUDE.md` and `AGENTS.md` through the snapshot redaction path and omits, as `known-duplicate`, an active rule whose normalized summary of at least 24 characters appears there. Other overlap is not detected. `CLAUDE.local.md` is not read because it is outside the declared source. `context --explain` explains this session-start projection, and `doctor` prints one line with applied lines, bytes, and omission counts by reason, never rule text. An empty result returns no hook output. The session-start hook no longer adds learning instructions, and the `learn --session` token store is removed. The session-end hook schedules bounded learning for that session when automatic learning is enabled, and a pure steering-cue check drops user-steering episodes without a durable steering phrase before any model call. The instruction pointer shrinks to three lines, and the context skill loses its routing and learning lines and triggers only on explicit Shadowclone requests or missing context. The plugin hook returns nothing when a native Claude integration covers the working directory. Portable skills replicate to `~/.agents/skills`, `~/.claude/skills`, and the Antigravity location only; an unchanged legacy `~/.cursor/skills` copy is retired like the legacy Codex copy. Starter and companion skills are no longer amended automatically; only skills the owner opts in with `skills manage` receive automatic additions.

**Harness init.** `shadowclone harness init` previews by default and writes with `--apply`. The first run asks for the new `repository-manifests` source and reads only `package.json` scripts and dependency names, lockfile names, `pyproject.toml`, `requirements.txt`, `Makefile` targets, `.github/workflows/*.yml`, and top-level entry names, each bounded in size and never through a symbolic link. The gate is a `check`, `verify`, `validate`, or `ci` script, else a Makefile `check` or `verify` target, else a composition of typecheck, lint, and test commands, else a Makefile `test` target or Bun's test runner. Python commands use `python3` unless the project uses `uv` or Poetry. CI counts as running the gate only when a workflow contains the exact command. `AGENTS.md` receives a managed section with read-first skills and their triggers, the commands and gate, the applicable rules, and a finish line. `CLAUDE.md` receives a managed `@AGENTS.md` import, created if missing, because Claude reads `AGENTS.md` directly only when no `CLAUDE.md` or `CLAUDE.local.md` exists; an existing import or a symlinked `CLAUDE.md` is left alone. Managed sections use HTML comment markers so an import inside them stays an ordinary paragraph and Claude strips the markers from context. The authored skills go to `.agents/skills/` and `.claude/skills/`, and `.shadowclone/harness.json` records the gate, derived conventions, source extensions, skills, applied rule keys, and a fingerprint for every managed artifact. Writes go through a `harness` revision kind, undo accepts only recorded repository roots and harness paths, and an edited section or file is reported as preserved instead of overwritten. Import strips harness sections, so harness text never returns to the profile as imported guidance.

**Taste and portability.** Rules reach the harness only through `compileProfile({ format: "harness" })`, the index lines without the session preamble, capped at 6 KiB. Personal global rules are included only when the owner confirms for that repository, and the answer is recorded in `harness.json`. The compiler accepts the repository's detected tools and top-level entries and omits as `not-applicable` a rule that names only known tools the repository does not use, or a backticked path whose first segment is absent. A rule that names one present tool stays, so an example mention does not drop it. Commands always come from detection, never from rule text. A personal skill named with `--skill` is copied verbatim after the owner selects it; the copy is refused if the redaction check changes any of its text. A skill copied earlier stays listed while its repository copy exists, and a teammate without the owner's library leaves it unchanged.

**Feature workflow.** The authored `feature-workflow` skill states its trigger, ordered steps (read `AGENTS.md` and the read-first skills, restate scope and proving checks, stop after planning when asked or when the change is broad, implement only approved work, add failing tests, run the detected gate without weakening checks, report commands and results, stop), approval boundaries, and verification. It is labeled as authored by Shadowclone and wraps its body in harness markers. A learned-adjustments section appears once sync supplies workflow and boundary rules. A second authored skill, `harness-builder`, tells an agent how to write the purpose, map, and invariants above the managed section.

**Harness check.** `shadowclone harness check` reads only the repository and its committed `harness.json`, so it runs without Shadowclone configuration for teammates and CI. Health checks report a missing or unmarked `AGENTS.md` and a missing or invalid read-first skill as errors, and an edited managed section, an `AGENTS.md` over 150 lines, a `CLAUDE.md` without the import, and a gate CI does not run as warnings. A gate script that `package.json` no longer declares is an error. Conventions run on all tracked and untracked files, or with `--changed` on files that differ from `HEAD`, so older violations do not block new work: file length for source files, forbidden text for source and prose files, suppressions matched inside real comments for TypeScript and JavaScript and by line elsewhere, and TypeScript comments through the repository's own `typescript` package, with a warning when it is not installed. Each finding carries a fix written for an agent. `--format json` serves tools, and `--format claude-stop` exits 2 with the findings on standard error. The stop format reads the hook's `cwd` and allows the stop when `stop_hook_active` is set, so it blocks once per stop and an unfixable finding never loops. `harness init --enforce-claude` merges that Stop hook into the owner's `.claude/settings.local.json`, which stays out of the committed manifest, and leaves a file that is not valid JSON alone. Other agents are held to the conventions through the `AGENTS.md` finish line, which names the check when conventions exist, and through CI; generating a CI workflow is deferred.

**Harness sync.** `shadowclone harness sync` re-renders the harness through the compiler with the answers recorded in `harness.json`, so later corrections reach the committed files. With the existing `claude-memory` source and `--apply`, it shows each new feedback or user note from the exact current repository's Claude memory and writes a confirmed note as a repository-scoped declared rule, keyed by the note's filename so a changed note updates the same rule. A ledger of filenames and content hashes under a hashed repository identity keeps declined notes from being asked again until they change. Project and reference notes are never offered, and native memory is never changed. Without `--apply`, sync writes nothing and reports how many notes are waiting. All applicable rules render in `AGENTS.md`, which every agent loads at session start, instead of splitting workflow rules into the skill. Session-start compilation reads the committed `harness.json` of the enclosing repository and omits its rule keys as `in-harness`, independent of repository guidance consent.

**Gated run.** `shadowclone run` executes the gate and `harness check --changed` in the worktree before committing, allows one repair attempt with the failure output, and otherwise leaves the change uncommitted with the gate result in the receipt.

**Comparison.** `shadowclone eval --harness` compares a native baseline (native skills, instructions, and memory) with the same baseline plus the harness on two synthetic repositories, a Bun task-list CLI and a Python configuration CLI, each with a frozen specification and held-out acceptance tests. Each task runs a planning stage that must stop, then an implementation stage with the saved plan. Metrics are deterministic where possible: acceptance tests, gate and check results, approval boundaries, scope violations, and unsupported completion claims. Corrections a reviewer would still give are left for human review.

**WIP inventory.** From record 021 the branch keeps native-duplicate omission, the reference library and recall, `context --explain`, de-duplicated portable locations, the Claude memory copy, profile repair, and the guidance protocol with neutral placeholders in place of private repository details. It removes source archival from native memory and adds Linux-portable test paths and memory type detection.

## Files

| Path | Change |
| --- | --- |
| `src/profile/compiler/` | Add the `index` format, applicability omission, and duplicate omission |
| `src/integrations/`, `src/cli/liveHooks.ts`, `src/cli/native.ts` | Deliver the 4 KiB index, drop learning text, dedupe plugin delivery, schedule learning at session end |
| `src/signal/steeringCue.ts`, `src/distill/excerpts.ts` | Skip model calls for sessions without steering cues |
| `src/harness/` | Detect facts, choose the gate, render, plan, apply, check, and sync the harness |
| `src/cli/harness.ts` | Expose `harness init`, `harness check`, and `harness sync` |
| `skills/feature-workflow/`, `skills/harness-builder/` | Authored workflow and map-enrichment skills |
| `src/config/` | Add the `repository-manifests` source, disabled by default |
| `src/dispatch/run.ts`, `src/dispatch/types.ts` | Gate commits and record the gate result |
| `src/eval/harness/` | Fixture repositories and the two-stage comparison |
| `README.md`, `docs/architecture/` | Describe the harness, delivery limits, consent, and evaluation |

## Data handling

`repository-manifests` is a new source, off by default and listed in the README. It reads only the named manifest files and top-level entry names of the repository where the command runs, stores derived commands and fingerprints in the committed `harness.json`, and sends nothing to a model. Profile text reaches `AGENTS.md` only through `compileProfile`, which resolves it through `resolveRedacted`; the preview warns that committed text is visible to anyone with repository access, and personal rules require per-repository confirmation. Harness sync reads Claude memory only under the existing `claude-memory` source for the exact current repository, through `resolveRedacted`, and never changes native memory. `harness check` reads repository files locally and reports paths and rule names without file contents. Gate output from `shadowclone run` stays within the authorized coding run and its receipt. Writing harness files is authorized by the explicit command; committing, pushing, or opening a pull request is not part of it.

## Alternatives

**Keep injecting a larger profile.** A 16 KiB packet did not arrive intact, and duplicated repository guidance displaced learned rules.

**Replace native memory.** Removing Claude memory made Claude ignore skills, and memory has a complete native delivery channel that hooks lack.

**One-shot generation like provider init commands.** A generated file with no learning loop or enforcement goes stale and remains advisory.

**Memory retrieval services.** Retrieval returns facts at runtime; it does not produce an enforced, reviewable repository environment.

**Separate `--alpha` installation mode.** The startup changes fix defects, and the harness is already opt-in per repository.

## Accepted costs

Repository skills are copied to two roots, so an agent that reads both may list a skill twice. The tool vocabulary for applicability is finite, so an unknown tool name passes. Stop-hook enforcement blocks only Claude until other providers' semantics are verified. The comparison uses synthetic repositories, which do not establish productivity on real work. The guidance protocol from record 021 keeps placeholder paths and no longer reproduces its private runs.

## Testing

Tests cover the 4 KiB cap, empty-profile silence, absent learning text, the three-line pointer, the recall line, native-duplicate omission, known-duplicate omission only under repository guidance consent, the doctor summary, applicability omission, plugin suppression beside native delivery, steering-cue gating with zero model calls, review-first starters and companions, and retirement of legacy Codex and Cursor copies. Harness tests cover Bun and Python detection, gate choice, managed sections that preserve surrounding text and refuse edited sections, the `@AGENTS.md` import, personal-rule consent, a planted profile secret absent from the harness, conventions with fix-it messages, the `claude-stop` exit code, sync promotion of user and feedback notes only, preset merging, and the gated run leaving a red change uncommitted. A rebuild test strips this repository's harness from a fixture copy and requires `harness init` to regenerate the gate, the file-length, comment, em-dash, and suppression conventions, the workflow skill, and the import. Every regression test is proven by reverting its guarded line, observing the failure, and restoring it. `bun run check` passes before each commit. Real agent runs remain manual verification.

## Open questions

Cursor loads `~/.agents/skills` and `~/.claude/skills` as well as its own root, so Shadowclone stops writing a Cursor copy. Whether Cursor de-duplicates the two remaining copies by name decides whether an agent-specific root can be dropped as well.

Whether Codex, Cursor, and Antigravity honor a blocking stop hook decides when enforcement extends beyond Claude.

## Decision record

Build the repository harness as the product because it reproduces how this repository was built.

Deliver at most 4 KiB at startup and never duplicate native guidance.

Build on native memory and never modify it.

Derive rules through the single compiler with per-repository consent for personal rules and an applicability filter.

Represent the owner's method as an authored workflow skill that sync keeps current.

Enforce mechanically through `harness check`, a Claude Stop hook, and gated headless commits.

Measure with a native baseline, held-out acceptance tests, and deterministic checks.
