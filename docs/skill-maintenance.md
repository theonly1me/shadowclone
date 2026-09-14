# Maintain your skill library

Skill maintenance adapts task-specific skills to your engineering preferences. It does not rewrite plugin packages or invent replacements for technical documentation.

## Setup

Default `shadowclone init` asks whether to keep skills in sync across detected agents, then configures the global library before installing integrations. For individual roots or later changes, use:

```bash
shadowclone skills configure --global
shadowclone skills configure --repo
```

This enables the named `skill-library` source, which defaults off. It does not enable transcripts, deep learning, or automatic learning. Global setup includes `.claude/skills`, `.agents/skills`, `.codex/skills`, `.cursor/skills`, and `.gemini/config/skills` beneath your home directory, plus supported provider `plugins/cache` roots. `CODEX_HOME` controls the Codex locations. Repository setup includes the supported skill directories in the current repository.

Custom roots require an explicit path. A third-party root receives local companion skills under `.agents/skills` in the chosen scope:

```bash
shadowclone skills configure --repo --root ./team-skills
shadowclone skills configure --global --root /path/to/plugin/skills --third-party
shadowclone skills roots
shadowclone skills unconfigure <root-id>
shadowclone skills disable
```

Unconfiguring a root stops discovery while retaining ownership records for recovery. Disabling the source stops all skill reads and assessment. Neither operation deletes your skills.

## Portable starter skills

The onboarding wizard installs each selected starter as a complete directory in `~/.agents/skills`, including references, assets, and other supporting files. This is the canonical personal copy. Shadowclone records equivalent copies for Claude Code, Codex, Cursor, and the Antigravity-compatible Gemini location.

Wizard reruns and skill maintenance, including maintenance invoked by deep learning, synchronize the recorded copies. If one copy changed since the previous synchronization, that copy becomes authoritative and its full tree is copied to the other locations. If multiple copies changed to different contents, synchronization reports a conflict and preserves every version. Symbolic links are rejected so a recorded skill cannot expand the synchronization boundary.

When the wizard selection changes, Shadowclone removes a deselected starter only when every recorded copy still matches its original installation. An edited starter is reclassified as adopted user guidance and preserved. A missing provider copy is recreated from the current canonical content. Existing skills are never silently adopted or replaced by onboarding.

## Update and review

```bash
shadowclone skills list
shadowclone skills update
shadowclone skills pending
shadowclone skills show <proposal-id>
shadowclone skills apply <proposal-id>
shadowclone skills reject <proposal-id>
```

Update requires deep-learning consent. It first synchronizes portable copies, then catches up on up to 60 steering episodes absent from the learning ledger and assesses the configured skill library. `shadowclone learn --deep` performs the same skill assessment when the skill-library source is enabled. Profile learning and skill assessment share the existing 20-call, five-minute allowance and Claude's supported two-dollar ceiling. Unchanged assessments are skipped. A large library may need subsequent runs, and the summary reports deferred skills.

Each model batch receives only one root's redacted skill documents and its scoped compiled profile. Global skills receive global preferences only. Repository skills receive only their matching context. Claude prompt history and its corresponding transcript count as the same independent session.

Existing skills remain user-owned by default. Proposed additions and routing changes remain pending until you approve a specific proposal. Original workflow bodies, supporting resources, and invocation settings remain intact. The model selects exact supporting passages from active preferences; missing support rejects the proposal. Rejected identical additions stay rejected even when unrelated profile guidance changes.

You can opt a specific user-owned skill into managed preference additions:

```bash
shadowclone skills manage <skill-id>
shadowclone learning enable
```

When deep and automatic learning consent are enabled, a native session hook gives the main agent one opaque learning command. The agent uses it only for a substantive session with reusable engineering guidance or a clear correction. Shadowclone schedules bounded catch-up after the requested session ends. A session boundary, stopped tool, added context, cancellation, question, temporary exception, or silence does not schedule learning on its own. Automatic skill changes require the file to match its recorded fingerprint. Later edits are preserved. Routing changes and unresolved conflicts still need review. Installed plugin caches cannot be adopted.

An approved third-party proposal creates a `shadowclone-local-<id>` companion in the appropriate local agent skill directory. The package remains unchanged. The companion applies only when its base skill is already selected and does not change the base skill's permissions. Subsequent supported preference additions can update the unedited companion automatically.

## Validation and limits

Discovery checks every `SKILL.md` in enabled roots without following symlinks or entering hidden subdirectories. Shadowclone's integration skill and generated companions are excluded from source assessment. Limits are 500 discovered files, 12 path segments, 48 KB per skill, and 8 MB total. Disable a broad root and configure smaller roots when a limit is exceeded.

Validation checks required YAML fields, duplicate top-level metadata, directory/name agreement, body size, matching code fences, and safe existing relative references. Referenced files are never executed or sent to the model. Duplicate names and model-identified routing, conflict, and technical-verification concerns remain visible in `skills list`. Unknown technical facts are flagged for review, not silently rewritten. Structural validation does not prove an arbitrary command or API is current.

## History, privacy, and evaluation

`shadowclone history` includes applied skill revisions. `shadowclone undo <revision-id>` restores the exact prior file when no later edit conflicts. History and proposals can contain private before/after skill text, stay local, and pass through redaction before detailed display. `shadowclone_skills_status` exposes root and pending-review counts through MCP without reading skill contents or making model calls.

`shadowclone forget --all` restores original maintained user skills, removes recorded companions, and removes local maintenance state. Edited maintained files stop cleanup so ownership is not discarded. Original plugin packages and user transcripts remain untouched.

Transfer evaluation restores original user skill text and routing and excludes generated companions from each repository snapshot. The skills and clone arms receive the same frozen personal context; only clone receives the compiled profile. This measures profile contribution separately from existing guidance. Live provider discovery and the usefulness of proposed skill changes need their own validation.
