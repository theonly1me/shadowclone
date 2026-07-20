import { file } from "bun";
import os from "node:os";
import path from "node:path";

const paths = [
  path.join(os.homedir(), '.zsh_history'),
  path.join(os.homedir(), '.bash_history'),
];


export async function getRecentShellHistory (lines: number): Promise<string> {
  let combinedHistory = "";

  for (const path of paths) {
    const historyFile = file(path);
    if (await historyFile.exists()) {
      const text = await historyFile.text();
      const recentLines = text.split("\n").slice(-lines).join("\n");

      combinedHistory += recentLines + "\n";
    }
  }

  return combinedHistory;
}
