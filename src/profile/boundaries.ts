export function blockedTools(profile: string): readonly string[] {
  const tools: string[] = [];
  const pattern = /^## Has refused (.+) tool requests$/gm;
  for (const match of profile.matchAll(pattern)) {
    const toolName = match[1];
    if (toolName) {
      tools.push(toolName);
    }
  }
  return [...new Set(tools)].sort();
}

export function isToolBlocked(options: {
  readonly profile: string;
  readonly toolName: string;
}): boolean {
  return blockedTools(options.profile).includes(options.toolName);
}
