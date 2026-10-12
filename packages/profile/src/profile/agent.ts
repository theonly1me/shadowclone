export function renderAgent(options: {
  readonly profile: string;
  readonly name?: string;
}): string {
  const name = options.name ?? "shadowclone";

  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(
      "Agent name must use lowercase letters, numbers, and hyphens",
    );
  }

  return [
    "---",
    `name: ${name}`,
    "description: A copy of the user that follows their learned engineering profile",
    "model: inherit",
    "tools: Read, Grep, Glob, Bash, Edit, Write",
    "---",
    "",
    options.profile.trim(),
    "",
  ].join("\n");
}
