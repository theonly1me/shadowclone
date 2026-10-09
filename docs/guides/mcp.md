# MCP server

The MCP server gives a connected agent seven tools. The agent can read the active guidance, search references, record a preference, read the history, check skill maintenance, and configure the cloud bot. The server runs on your machine and needs no Shadowclone credentials.

## Start the server

The Shadowclone plugin registers the server for you. Its configuration starts `shadowclone mcp` after you install the CLI:

```json
{
  "mcpServers": {
    "shadowclone": {
      "type": "stdio",
      "command": "shadowclone",
      "args": ["mcp"]
    }
  }
}
```

Add the same entry to the MCP settings of any agent that supports stdio servers. The server reads JSON-RPC 2.0 messages from standard input, one for each line. It uses MCP protocol version `2024-11-05` and the methods `initialize`, `tools/list`, and `tools/call`. Restart your agent session after the install so that the agent loads the server.

The tools follow your consent settings and the managed policy. If a managed policy turns Shadowclone off, the tools return a disabled message, an error, or no results. Opening the server makes no model request.

## Tools

| Tool                        | Input                                                                 | Use it to                                                       |
| --------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `shadowclone_context`       | None                                                                  | Read the learned skills and native routing for this repository  |
| `shadowclone_profile`       | None                                                                  | Do the same as `shadowclone_context`. It is a deprecated alias  |
| `shadowclone_recall`        | `query` (1 to 1,000 characters), `limit` (1 to 10, default 3)         | Search the scoped reference records                             |
| `shadowclone_remember`      | `text` (1 to 8,192 characters), `scope` (`repository` or `global`)    | Record a preference that you asked for                          |
| `shadowclone_history`       | None                                                                  | List the local revisions                                        |
| `shadowclone_skills_status` | None                                                                  | Count the skill roots, the managed skills, and the pending work |
| `shadowclone_bot`           | `operation` (`setup` or `status`), and the options in the bot section | Configure the cloud bot or read its status                      |

The tools `shadowclone_recall`, `shadowclone_remember`, `shadowclone_history`, `shadowclone_skills_status`, and `shadowclone_bot` reject input fields that they do not list.

### Read guidance

`shadowclone_context` returns the guidance that applies to the repository where the server runs. It returns the same text as `shadowclone context`. If policy turns Shadowclone off, it returns "Shadowclone context is disabled."

`shadowclone_recall` returns the full text of the matching reference records. It limits results to the scope of the current repository and respects blocked origins. If nothing matches, it returns "No matching references found." The command `shadowclone recall <query>` does the same job.

### Record and read history

`shadowclone_remember` records the preference locally and returns "Recorded preference" with its key. The tool description tells the agent never to infer consent from a task or an interruption. The tool does not authorize any action. Use `repository` for a rule that applies to one repository and `global` only for a rule that applies everywhere.

`shadowclone_history` returns a JSON list of revision identifiers with their times and counts. It does not show the guidance of other repositories. Use `shadowclone history <revision>` and `shadowclone undo <revision>` in a terminal to read or reverse a revision.

`shadowclone_skills_status` returns a JSON object with `roots` (the enabled skill roots), `managed` (the skills that Shadowclone maintains), and `pending` (the items that wait for review). It reads no skill content and makes no model call. Use the CLI to review or update skills.

### Configure the cloud bot

`shadowclone_bot` has these inputs:

| Input           | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `operation`     | `setup` or `status`. Required.                                         |
| `repository`    | The repository as `owner/repository`                                   |
| `bot`           | The GitHub login of the machine account of the bot                     |
| `approveSkills` | `true` only after the owner approved the listed skill files            |
| `engine`        | `claude` or `codex`. The default is `claude`.                          |
| `codexAuth`     | `api-key` or `plan`. The default is `api-key`. `plan` is experimental. |

The behavior depends on the inputs:

- `status` with a saved `repository` returns the checklist of open setup steps. Otherwise it returns the saved status of the bot as JSON.
- `setup` with `bot` and `repository` sets up a machine account bot. If the account does not exist, the tool opens the GitHub signup page. The first call returns the skill files that setup will push. Show the list to the owner. Call again with `approveSkills` set to `true` only after the owner agrees. The last answer lists the open steps and opens their GitHub pages.
- `setup` with `bot` and no `repository` returns an error that asks for the repository.
- `setup` with no `bot` starts the local wizard and returns its URL. The owner chooses a machine account or a GitHub App there. Keep the MCP connection open until setup ends.

The owner enters every token on GitHub, never in the tool. See the [cloud bot guide](cloud-bot.md) for the full setup.
