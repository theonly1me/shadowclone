function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shellBody(command: string): string | null {
  const marker = " -lc ";
  const position = command.indexOf(marker);
  if (position < 0) return null;
  const raw = command.slice(position + marker.length).trim();
  if (raw.length < 2) return null;
  const quote = raw[0];
  if ((quote !== "'" && quote !== '"') || raw.at(-1) !== quote) return null;
  return raw.slice(1, -1).replaceAll('\\"', '"');
}

function directRead(command: string, filePath: string): boolean {
  const body = shellBody(command);
  if (!body) return false;
  const suffix = [`'${filePath}'`, `"${filePath}"`, filePath].find((candidate) => body.endsWith(candidate));
  if (!suffix) return false;
  const prefix = body.slice(0, -suffix.length).trim();
  return prefix === "cat" || /^head -n \d+$/.test(prefix) || /^sed -n ['"][^'";|&]+['"]$/.test(prefix);
}

export function observedSkillReads(options: {
  readonly stream: string;
  readonly skillPaths: Readonly<Record<string, string>>;
}): string[] {
  const names = new Set<string>();
  for (const line of options.stream.split("\n")) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(event) || event.type !== "item.completed" || !isRecord(event.item)) continue;
    const item = event.item;
    if ((item.item_type ?? item.type) !== "command_execution" || item.status !== "completed" ||
      item.exit_code !== 0 || typeof item.command !== "string") continue;
    for (const [name, filePath] of Object.entries(options.skillPaths)) {
      if (directRead(item.command, filePath)) names.add(name);
    }
  }
  return [...names].sort();
}

export function claudeSkillReads(options: {
  readonly actions: readonly { readonly tool: string; readonly path: string | null; readonly command?: string | null }[];
  readonly locations: Readonly<Record<string, readonly string[]>>;
}): string[] {
  const names = new Set<string>();

  for (const action of options.actions) {
    for (const [key, paths] of Object.entries(options.locations)) {
      const skill = key.slice(key.indexOf(":") + 1);
      const invoked = action.tool === "Skill" && (action.command === skill || action.command?.endsWith(`:${skill}`) === true);
      const read = action.tool === "Read" && action.path !== null && paths.includes(action.path);

      if (invoked || read) {
        names.add(key);
      }
    }
  }

  return [...names].sort();
}
