# Development priorities

The [architecture overview](README.md) describes the implementation. These priorities cover remaining qualification and research work.

## Skill quality and delivery

Learning must preserve the intent of an existing workflow, choose an appropriate skill, and leave uncertain changes reviewable. Synthetic tests cover publication and ownership; behavioral evaluation must also measure whether agents select the skill and follow it on fresh work.

Original libraries and native memory remain separate baselines. [Evaluation](09-evaluation.md) describes the measurements and limitations.

## Provider qualification

Qualify capture, learning, native guidance, and delegated execution separately for each provider. A working transcript adapter does not prove safe unattended execution. New support needs current provider contracts, synthetic fixtures, and live compatibility checks for the advertised path.

Antigravity has capture and native guidance, but no model runner. API and local-endpoint engines are unimplemented. Required execution controls must be enforceable before adding a runner.

## Product validation

Exercise setup, migration, conflict recovery, and removal on real installations with explicit source consent. Browser and terminal choices must publish equivalent guidance and preserve shared requirements.

Measure whether maintaining guidance reduces user effort across repeated tasks. Preference scores alone do not measure productivity, and successful publication alone does not prove useful learning.

Merge outcomes, issue-tracker task intake, and coordination between concurrent clones remain outside the implemented learning workflow. They need their own evidence and action boundaries before becoming supported features.
