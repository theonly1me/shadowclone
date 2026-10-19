import { open } from "node:fs/promises";
import { ownedDirectory } from "@shadowclone/core";
import type { CloneConfig } from "../config/config";
import { githubTokenSecret, providerLogins } from "../config/providers";
import type { ClonesPaths } from "../config/store";

export type SecretLine = {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
};

export function tokenPageUrl(config: Pick<CloneConfig, "ownerLogin">): string {
  const parameters = new URLSearchParams({
    name: "shadowclone clones",
    description: "Clones that work as me",
    target_name: config.ownerLogin,
    expires_in: "366",
    contents: "write",
    issues: "write",
    pull_requests: "write",
    actions: "read",
    metadata: "read",
  });

  return `https://github.com/settings/personal-access-tokens/new?${parameters.toString()}`;
}

export function secretLines(config: CloneConfig): readonly SecretLine[] {
  const login = providerLogins[config.provider];

  return [
    {
      name: githubTokenSecret,
      description: `A fine-grained token for ${config.repository} and ${config.skillsRepository}: ${tokenPageUrl(config)}`,
      required: true,
    },
    ...(login.secret === null
      ? []
      : [{ name: login.secret, description: login.label, required: login.secretRequired }]),
  ];
}

export async function createSecretsFile(options: {
  readonly paths: ClonesPaths;
  readonly lines: readonly SecretLine[];
}): Promise<"created" | "present"> {
  await ownedDirectory(options.paths.directory);

  const handle = await open(options.paths.secretsFile, "wx", 0o600).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return null;
    }

    throw error;
  });

  if (handle === null) {
    return "present";
  }

  try {
    const template = options.lines.flatMap((line) => [
      `# ${line.description}${line.required ? "" : " (optional)"}`,
      `${line.name}=`,
      "",
    ]);

    await handle.writeFile(template.join("\n"));
  } finally {
    await handle.close();
  }

  return "created";
}
