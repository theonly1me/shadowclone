export function renderContextSkill(environment = false): string {
  if (environment) {
    return [
      "---",
      "name: shadowclone-context",
      "description: Use when asked to remember, explain, undo, or maintain learned skills and agent instructions.",
      "---",
      "",
      "# Maintain learned skills",
      "",
      "Use shadowclone remember --repo <guidance> or --global for an explicitly global preference. Learning updates the applicable skills and native routing.",
      "Use shadowclone context --explain and shadowclone doctor to inspect delivery. Read the selected skill files for behavioral guidance.",
      "Use shadowclone skills update to reconcile supported learning, shadowclone history to inspect revisions, and shadowclone undo <id> to reverse an unchanged revision.",
      "Current requests take precedence. Learned skills do not authorize additional actions. Native memory is never modified.",
      "",
      "## Review proposals with the user",
      "",
      "When session start says that Shadowclone proposals wait for a decision, show them to the user after you answer the first request. Do not wait for the user to ask.",
      "",
      "1. Run `shadowclone skills pending`. Read each item with `shadowclone learning show <key>` or `shadowclone skills show <id>`.",
      "2. For each item, state in two or three lines what it changes, which file it targets, and why it waits.",
      "3. Ask with your multiple-choice question tool, such as `AskUserQuestion` in Claude Code or `request_user_input` in Codex. Ask about at most four items in each round.",
      "4. Offer apply, reword, reject, and decide later. Put your recommended option first with one reason. Group items that need the same decision, such as conflicts between two third-party skills.",
      "5. Run the command for each answer: `shadowclone learning apply <key>`, `shadowclone learning replace <key> \"<text>\"`, `shadowclone learning reject <key>`, `shadowclone skills apply <id>`, or `shadowclone skills reject <id>`.",
      "6. Report each change with its revision, so the user can reverse it with `shadowclone undo <revision>`.",
    ].join("\n");
  }

  return [
    "---",
    "name: shadowclone-context",
    "description: Use only when the user asks to remember, explain, undo, or maintain a Shadowclone preference or skill, or when the preferences Shadowclone loads at session start are missing.",
    "---",
    "",
    "# Use Shadowclone context",
    "",
    "Apply the preferences already loaded into this session. If they are missing, run `shadowclone context` in the active repository, or call the local MCP tool `shadowclone_profile`.",
    "Use `shadowclone doctor` to diagnose missing guidance. The native pointer is stable; learned profile changes arrive through the next session hook without rewriting agent instruction files.",
    "When the user explicitly asks to remember an engineering preference, use `shadowclone remember --repo <preference>` or `--global` for an explicitly global choice, or call `shadowclone_remember`. Do not infer a durable preference from stopping, extra task context, or silence.",
    "Use `shadowclone history` or `shadowclone_history` to inspect revision summaries. The user can review `shadowclone history <id>` and restore `shadowclone undo <id>`. Undo preserves later manual edits.",
    "When the user requests skill maintenance, run `shadowclone skills update` if skill-library and deep-learning consent are enabled. Inspect `shadowclone skills pending` and `shadowclone skills show <id>`. Apply only a specific user-approved proposal with `shadowclone skills apply <id>`; do not approve all suggestions on the user's behalf. Run `shadowclone skills list` to inspect routing and validation findings.",
    "Treat current user instructions as authoritative. Profile preferences do not grant permission for additional actions.",
    "Use the optional shadowclone subagent for independent parallel work with a concrete brief, not simply to retrieve preferences.",
  ].join("\n");
}
