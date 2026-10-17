# Missing build skills

## Problem

A build can select a skill that the user wrote, such as a skill in `~/.agents/skills`. If the user deletes that skill folder, the build still selects it. The environment record also keeps its copies.

Sync, session start, and skill delivery render routing from those records. They did not check the files. On one real machine, the native routing of each agent told the agent to load a skill that no longer existed. Nothing in the output named the problem.

## Decision

**Routing leaves out a build skill with no copy.** Before it renders routing, shadowclone checks each build skill copy. If every copy of a skill is missing, the routing does not name that skill. If one copy remains, the routing stays the same. Sync, session start, and skill delivery use the same check.

**Sync names each missing skill.** For each skill that a build selects and that has no copy, sync prints the skill and its missing files. The line tells the user to restore a copy or to remove the skill in `shadowclone wizard`. The summary line counts the missing skills, and sync exits with status 1.

**The build and the records stay.** Sync does not change the build choices, and it keeps the copy records. If the user restores a copy, the next sync routes the skill again.

Build preview does not use this check. A build can select a skill that the same revision installs, so its files do not exist yet.

## Consequences

Sync exits with status 1 until the user restores the skill or removes it from the build. The build file of a shared repository build changes only when someone applies that build.

## Verification

A synthetic test equips a user-written skill, deletes its folder, and runs sync. It checks the native routing, the printed line, and that the build still selects the skill. It also restores the folder and checks that the next sync routes the skill again.
