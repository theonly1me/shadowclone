# Agent builds

Choose and equip skills from a constellation built from their categories and purposes:

```bash
shadowclone wizard
```

![Agent builds showing grouped skill hubs, a build summary, and skill details](../assets/agent-builds.jpg)

Select a skill to read its instructions and decide whether to equip it. Keep a personal build across agents, tailor a private build to a repository, or choose shared repository standards. **Review your build** shows the files that will change before you apply it. You can return and adjust your build at any time.

A bundled skill can include supporting files, such as a checker script or a page template. Applying the build copies them next to each installed `SKILL.md`. A later version replaces copies you have not edited. If you edited a copy, applying stops and names the conflict. Unequipping a skill removes its unedited files and keeps edited ones, with a warning.

The constellation creates four to twelve top-level hubs for a typical library and nests groups larger than ten skills. Each category has an icon and a skill count. Select a category to expand or collapse it; libraries with more than forty skills start collapsed. Larger categories open in groups of at most ten children. Search opens the branches containing matching skills. Drag to pan and scroll or pinch to zoom. **Fit** shows the whole visible map; **Reset** restores a readable scale. **Map / list** exposes every skill in a compact list and becomes the default on narrow screens.

## Create a skill

Choose **Create a skill**, give it a name, explain when it applies, and write what the agent should do.

**Use AI** can help draft the instructions. Review the text, provider, and limits before sending, then edit the result before adding it to your build. Applying the build is a separate step.

<p align="center"><img src="../assets/create-skill.jpg" alt="Creating an accessible-interfaces skill with a trigger and editable instructions" width="720"></p>

## Other ways to open the wizard

| Command | Use it to |
| --- | --- |
| `shadowclone wizard --repo` | Open a private build for the current repository |
| `shadowclone wizard --no-open` | Print the local URL instead of opening a browser |
| `shadowclone wizard --cli` | Configure a build in the terminal |

Keep the command running while using the browser editor. Ctrl+C stops it. Opening the editor makes no model request. The optional **Describe my agent with my model** action has its own reviewed request.

After applying a build, open a new coding-agent session to load the installed guidance.
