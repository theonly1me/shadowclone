import type { EngineRunOptions } from "./types";

export function cursorReviewPermissions(options: EngineRunOptions): {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
} {
  const network = options.execution.purpose === "review" && options.execution.network === true;

  return {
    allow: ["Read(**)", ...(network ? ["WebFetch(*)"] : [])],
    deny: ["Shell(*)", "Write(**)", "Write(/**)", "Mcp(*:*)", ...(network ? [] : ["WebFetch(*)"])],
  };
}
