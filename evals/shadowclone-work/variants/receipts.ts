const receiptsParagraph = `**Receipts.** Record the work with the \`shadowclone_task\` MCP tool. It may be deferred: load it with ToolSearch (search for \`shadowclone_task\`) before you conclude it is missing. Call operation \`start\` after reading the repository's rules, with a \`title\`, \`host\` set to \`claude-code\`, a \`sessionId\`, concrete \`acceptance\` criteria, and repository-relative \`scopes\`. Record a \`delivery\` checkpoint after reading the guidance it returns. Run \`verify\` before \`gh pr ready\`, record a \`review\` checkpoint with evidence for each acceptance criterion, and \`complete\` the task at the end. If a receipt operation fails, report it and continue. Receipts never replace the checks in this process.

`;

export function withReceipts(skillText: string): string {
  const guardrails = "## Guardrails";
  const completionLine = "anything you could not verify.";

  if (!skillText.includes(guardrails) || !skillText.includes(completionLine)) {
    throw new Error("The skill text no longer has the anchors the receipts variant needs");
  }

  return skillText
    .replace(guardrails, `${receiptsParagraph}${guardrails}`)
    .replace(completionLine, `${completionLine} Include the task id and its final receipt state.`);
}
