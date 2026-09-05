import { getRecentShellHistory } from "./collector";
import { distillHistory } from "./distiller";

async function main() {
  console.log("Starting Shadowclone Daemon...");

  const history = await getRecentShellHistory({ lineCount: 100 });

  if (!history.trim()) {
    console.log("No history found.");
    return;
  }

  console.log("🔍 Passing history to the Distiller...");
  const extractedSkill = await distillHistory(history);

  console.log("\n✨ LLM Output:");
  console.log(JSON.stringify(extractedSkill, null, 2));
}

await main();
