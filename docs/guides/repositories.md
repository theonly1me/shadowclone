# Repository setup

You can share instructions, skills, and checks with everyone who works in a repository. There are two ways to do it. Use `init --repo` for instructions, skills, and checks. Use the wizard for a shared skill build.

## Set up the repository

```bash
shadowclone init --repo
```

Setup asks to read the project manifests, finds the checks, and previews the shared instructions and workflow skills. It asks again before it adds personal preferences to files that your team can see. Review the files and commit the ones that you want to share.

| File                                    | Purpose                                                         |
| --------------------------------------- | --------------------------------------------------------------- |
| `AGENTS.md`                             | Shared instructions, selected skills, and verification commands |
| `CLAUDE.md`                             | Import of the shared instructions                               |
| `.agents/skills/` and `.claude/skills/` | Repository workflows and selected personal skills               |
| `.shadowclone/harness.json`             | Configured checks, conventions, and file fingerprints           |

Use `--personal` or `--no-personal` to include or exclude your applicable personal guidance. Repeat `--skill <name>` to copy selected personal skills with their resources. Use `--no-enforce` to skip the Claude Stop hook.

## Share a skill build

The wizard can write a build for the repository. This build is the **Shared · this repository** scope.

1. Run `shadowclone wizard --repo`.
2. Open the **Build scope** menu and choose **Shared · this repository**.
3. Equip skills and apply the build.

The build writes `.agents/skills`, `.claude/skills`, and a guidance block in the repository `AGENTS.md`. `CLAUDE.md` imports that block. Review the files before you commit them. The **Personal · this repository** scope keeps a build private on your machine instead. A private build cannot weaken a shared requirement. See [Agent builds](agent-builds.md#choose-a-build-scope).

## Check and refresh

Run `shadowclone check --changed` to check your uncommitted work. Run `shadowclone check` to check the whole repository. A local Claude Stop hook runs these checks before the agent finishes. Other agents get the checks through the repository instructions.

Run `shadowclone sync` to refresh the setup. Your text outside the managed sections stays yours. Shadowclone keeps an edited managed section for your review.

A skill that Shadowclone leaves out of its routing can still reach an agent through the global configuration of that agent.
