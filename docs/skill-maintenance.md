# Maintain your skill library

Shadowclone uses durable learning to update an existing workflow or create a missing skill. It preserves evidence internally and publishes native instructions that explain when to read the skills.

## Setup and permissions

Default setup asks separately about reading sessions, synchronizing and automatically maintaining skills, and background learning. Skill reads use the default-off `skill-library` source. Automatic editing is a separate environment setting; deep and automatic learning remain separate controls.

```bash
shadowclone skills configure --global
shadowclone skills configure --repo
shadowclone migrate skills --repo /path/to/repository
shadowclone migrate skills --apply --automatic --memory --repo /path/to/repository
shadowclone skills pending
shadowclone migrate skills --apply --activate-only
```

Preview does not invoke a model or write files. Apply saves the original library, retains all learning, and publishes supported changes in reversible batches. Repeat apply to continue a large migration. Register every repository whose scoped learning should be published. Unregistered scopes remain stored and visible.

`--automatic` authorizes supported maintenance of user-owned skills. `--memory` enables recurring read-only extraction from the registered repositories' Claude memory. Neither changes native memory. Omit these flags to retain the current settings.

Global roots include `.agents/skills`, `.claude/skills`, supported provider skill directories and configured plugin caches. Repository roots remain restricted to their registered repository. Custom roots can be configured with `--root`; third-party roots use `--third-party` and cannot be edited as user skills.

## Updating and resolving conflicts

```bash
shadowclone skills update
shadowclone skills automatic on
shadowclone skills automatic off
shadowclone skills pending
shadowclone skills retry <learning-key>
shadowclone skills exclude <learning-key> <reason>
```

The planner reviews the consented library, selects a relevant skill, and inspects its complete redacted instructions. Existing skills receive exact section edits; unrelated text, invocation permissions, resources, and intent are preserved. New skills group coherent workflows instead of creating a file for every correction. Global and repository evidence are processed separately.

Conflicts, unsupported technical changes, ambiguous edits, and capacity problems remain pending. Resolve a conflicting file before retrying. Exclusion requires an explicit reason and stays in the evidence record. `skills automatic off` stops automatic skill maintenance without deleting published skills. `skills disable` disables library reads independently. Legacy per-proposal `show`, `apply`, `reject`, and `manage` commands remain for unmigrated installations.

Learning and drafting share the existing allowance of 20 calls, five minutes, and the engine's supported $2 ceiling. Unchanged evidence is skipped. `skills pending` distinguishes completed capture from unfinished publication.

## Delivery and resources

`shadowclone-baseline` carries universal behavior and is mandatory before every task. Workflow skills carry relevant preferences, procedures, prerequisites, and examples. Native sections route tasks to skills and may include short standalone facts. Baseline and native sections each have a 4 KiB ceiling. Overflow is explicit and retains the source evidence.

Global skills live in canonical `~/.agents/skills`, with complete copies for Claude and Antigravity. Codex and Cursor read the canonical directory. Repository skills stay under their repository's `.agents/skills` and `.claude/skills`. Supporting files retain bytes and executable permissions. They are checked locally and are not sent to the learning model or executed during maintenance.

Third-party packages receive local companions. A companion applies only when its base skill is already selected and preserves its permissions. Dispatch and evaluation materialize the relevant library, including the base skills, inside their isolated workspace.

`shadowclone sync` refreshes native routing and propagates a single changed maintained copy. Divergent changes preserve every version and require reconciliation. Publication rejects symbolic links and missing or unsafe references. The discovery limits remain 500 files, 12 path segments, 48 KB per skill, and 8 MB total. A resource publication is limited to 512 KB before replication and must fit the revision history budget.

## Recovery and evaluation

Each publication records skills, resources, native sections, and evidence decisions together. `history` lists revisions and `undo <revision>` restores one if later edits do not conflict. Forget restores tracked originals and refuses conflicting edits; native memory and third-party packages are untouched.

`guidance-skills-v1` compares the frozen original library against the maintained library with native routing. Original skills with memory form their own condition. The maintained condition has no profile overlay. Historical profile evaluations remain unchanged and cannot establish the benefit of the new skill updates.
