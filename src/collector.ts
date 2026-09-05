import { file } from "bun";
import { projectPaths } from "./paths";
import { redactSecrets } from "./redact";

export const defaultHistoryPaths = projectPaths.shellHistoryFiles;

export async function getRecentShellHistory(options: {
  lineCount: number;
  historyPaths?: readonly string[];
}): Promise<string> {
  const historyPaths = options.historyPaths ?? defaultHistoryPaths;

  let combinedHistory = "";

  for (const historyPath of historyPaths) {
    const historyFile = file(historyPath);
    if (await historyFile.exists()) {
      const text = await historyFile.text();
      const recentLines = text.split("\n").slice(-options.lineCount).join("\n");

      combinedHistory += recentLines + "\n";
    }
  }

  return redactSecrets({ text: combinedHistory });
}
