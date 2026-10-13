import { readFileSync } from "node:fs";
import path from "node:path";

const sourcesInDependencyOrder = [
  "trigger/command",
  "receivers/signature",
  "receivers/handler",
  "receivers/launch",
  "receivers/daytona",
  "receivers/e2b",
  "receivers/launchers",
  "receivers/runtime",
];

export function receiverBundle(): string {
  const transpiler = new Bun.Transpiler({ loader: "ts", trimUnusedImports: true });
  const modules = sourcesInDependencyOrder.map((name) =>
    transpiler
      .transformSync(readFileSync(path.join(import.meta.dir, "..", `${name}.ts`), "utf8"))
      .replace(/^import\s[\s\S]*?\sfrom\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, ""),
  );

  return `${modules.join("\n")}\nexport { launchers, receiveWebhook, receiverRuntime };\n`;
}
