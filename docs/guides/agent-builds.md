# Agent builds

An Agent build is the set of workflow skills that your agents load. You pick the skills on a browser skill map, and Shadowclone installs them for your agents. A build can be personal, private to one repository, or shared with your team.

```bash
shadowclone wizard
```

![Agent builds showing skills grouped by source and category, a named build, and skill details](../assets/agent-builds.jpg)

## Pick skills on the Skill constellation

The browser calls the skill map the Skill constellation. The map shows every local skill at once. Skills group by source first: bundled skills, working preferences, your custom skills, your skills, and one group for each plugin. Inside a source, skills group by category.

- Click a skill to equip it or unequip it and to read its details.
- Click a category to equip every skill in it. If you equipped all of them, the click unequips them.
- Click the chevron on a group to collapse it. The wizard remembers collapsed groups in this browser.
- Use search to highlight matching skills.
- Use **Map / list** to see a compact list. The list is the default on narrow screens.

A plugin manages some skills, and you cannot equip them. Their details offer a local companion skill. **Review your build** shows the files that will change before you apply the build. You can return and change the build at any time. After you apply it, open a new coding-agent session.

## Always-on writing skill

`write-plain-english` is always on. The wizard shows it as locked on, and every build includes it. Its routing line is "before you write any text that a person reads". `shadowclone sync` adds it to existing builds.

## Choose a build scope

The **Build scope** menu sets where a build applies.

| Scope                      | Applies to                       | What Shadowclone writes                                                                                            |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Personal · everywhere      | Every repository and every agent | Skills in `~/.agents/skills`, `~/.claude/skills`, and `~/.gemini/config/skills`, and native routing for each agent |
| Personal · this repository | This repository only             | Skills in a private folder under `~/.shadowclone/builds/`, outside the repository                                  |
| Shared · this repository   | Everyone who uses the repository | `.agents/skills`, `.claude/skills`, and a guidance block in the repository `AGENTS.md`, which `CLAUDE.md` imports  |

To make a shared build, follow these steps:

1. Run `shadowclone wizard --repo` in the repository. The wizard opens on **Personal · this repository**.
2. Open the **Build scope** menu and choose **Shared · this repository**.
3. Equip the skills that the team needs, and read **Review your build**.
4. Apply the build, then review the new files and commit them.

A private build cannot weaken a shared requirement. A shared skill cannot contain the personal paths of your machine. Anyone with access to the repository can read committed files. To add checks as well, read [repository setup](repositories.md).

## Your build name

The character sheet names your build. It shows a short profile, three abilities tied to your equipped skills, and one tradeoff. Five seconds after your last equip change, the wizard asks your fast model for a new name.

- On Claude Code, the fast model is Haiku at low effort with thinking off.
- On Codex, the fast model is `gpt-6-luna` at low effort.
- The sheet names the engine and the model that wrote the name.

A saved build that you open without a change shows **Name my build**, so opening the wizard makes no model request. If naming fails, the sheet shows the error and a **Retry** button. **Turn naming off** stops all naming requests in this browser.

## Your writing voice

Skills that write for you, such as the pull request and review skills, read `~/.agents/voice.md`. **My voice** can draft that file from your own GitHub writing.

1. Choose **My voice** and allow Shadowclone to read your GitHub writing. It reads through your `gh` login.
2. Choose **Read my writing and describe my voice**. Your learning model describes your style and writes 3 invented examples.
3. Edit any line of the description. Choose **Rewrite the samples** to see the examples follow your edits.
4. Choose **Save my voice** to write `~/.agents/voice.md`, or choose **Discard**.

The dialog never shows your writing. Shadowclone skips text that an agent wrote. It discards a result that copies 8 or more of your words in a row. If `~/.agents/voice.md` already exists or is a link, Shadowclone does not change it. [Data handling](../data-handling.md) lists what Shadowclone reads and sends.

## Create a skill

Choose **Create a skill**, give it a name, explain when it applies, and write what the agent must do. **Use AI** can draft the instructions. Review the text, the provider, and the limits before you send. Edit the result before you add it to your build. Applying the build is a separate step.

<p align="center"><img src="../assets/create-skill.jpg" alt="Creating an accessible-interfaces skill with a trigger and editable instructions" width="720"></p>

## Shared files and links

- If `~/.claude/skills/<name>` links to the skill's own folder, for example `~/.agents/skills/<name>`, that agent already reads the skill. The wizard writes nothing there.
- If an agent's instruction file links to a file in your home folder, the review shows that real file as the file that changes.
- The wizard skips a link to any other place and names it in the review.
- A bundled skill can include supporting files, such as a checker script. Applying the build copies them next to each installed `SKILL.md`.
- A later version replaces copies that you did not edit. If you edited a copy, applying stops and names the conflict.
- Unequipping a skill removes its unedited files and keeps edited files, with a warning.

## Other ways to open the wizard

| Command                        | Use it to                                        |
| ------------------------------ | ------------------------------------------------ |
| `shadowclone wizard --repo`    | Open a build for the current repository          |
| `shadowclone wizard --no-open` | Print the local URL instead of opening a browser |
| `shadowclone wizard --cli`     | Configure a build in the terminal                |

Keep the command running while you use the browser. Press Ctrl+C to stop it. Opening the wizard makes no model request.
