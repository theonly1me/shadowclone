# Synced skills

## Problem

Another product can sync its own skills into `~/.claude/skills/synced/<id>/<name>/SKILL.md`. On one real machine, that folder held the Anthropic example skills, such as `docs` and `xlsx`. The manifest in each folder names the source of each skill.

shadowclone treated all of `~/.claude/skills` as the user's own skills. So it treated the synced skills as the user's own skills too:

- Library review compared a synced skill with a plugin skill, because one side counted as the user's. It proposed 9 conflicts between skills that the user did not write.
- Review also compared plugin skills, such as a Vercel `verification` skill, with the user's own skills. A conflict like that does not confuse the user's agents, so the proposal was noise.
- Learning picked the synced `docs` skill as the target of a rule. It edited the synced file in place and copied it into three agent skill folders. Its long description then filled about a quarter of the native routing.

The skills guide says that third-party packages stay unchanged, and that review never compares two third-party skills. Both rules failed for the synced folder.

## Decision

**Discovery skips the synced folder.** In the global `~/.claude/skills` root, discovery skips each skill under `synced/`. Review, learning, delivery, and personal skill sync all use discovery, so none of them reads, edits, compares, or copies a synced skill.

**The check uses the path.** Discovery skips a skill when its first folder is `synced` and the root is the global `.claude/skills` folder. A repository root and a custom root keep a folder named `synced`.

**Review compares only the user's own skills.** Library review reads only the roots that the user owns. It never reads a plugin skill, so it never proposes a conflict with one.

**Review closes old proposals.** At the next library review, each pending conflict with a synced skill or a plugin skill becomes superseded. Review no longer discovers one of its skills.

shadowclone does not treat the synced folder as a third-party root that gets local companions. A companion would still add learned guidance to a skill that the user did not choose. Proposals about such skills are noise to the user.

## Consequences

A rule that shadowclone already published into a synced skill stays, with its copies, until the user retires it with `shadowclone learning retire`. Discovery no longer offers the synced skill as a target, so learning puts a new rule into a skill that the user owns.

Retirement also reaches a skill record outside the copies that discovery finds. If the file still has the text that shadowclone wrote, retirement writes back the earlier text and drops the record. If the file changed, retirement keeps the file and its record.

## Verification

A synthetic test puts a skill in `~/.claude/skills/synced/` and routes a rule to it. Without the check, learning rewrites the synced file. Another test puts a synced skill next to a plugin skill that disagrees with it, and checks that review makes no conflict proposal. Two more tests retire a rule that shadowclone wrote into a synced skill. The file gets its earlier text back, unless it changed after the edit.
