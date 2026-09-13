import path from "node:path";
import { z } from "zod";
import { readLocalText, replaceLocalText } from "../localFiles";
import type { ProjectPaths } from "../paths";
import { integrationSchema, type Integration } from "./types";

const stateSchema = z.strictObject({ version: z.literal(1), integrations: z.array(integrationSchema) });

export async function readIntegrations(paths: ProjectPaths): Promise<readonly Integration[]> {
  const text = await readLocalText(path.join(paths.shadowcloneDirectory, "integrations.json"));
  if (text === null) return [];
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Invalid native integration manifest; restore it before changing installations"); }
  const result = stateSchema.safeParse(value);
  if (!result.success) throw new Error("Invalid native integration manifest; restore it before changing installations");
  return result.data.integrations;
}

export async function saveIntegration(options: {
  readonly paths: ProjectPaths;
  readonly integration: Integration;
  readonly remove?: boolean;
}): Promise<void> {
  const filePath = path.join(options.paths.shadowcloneDirectory, "integrations.json");
  const previous = await readLocalText(filePath);
  const integrations = await readIntegrations(options.paths);
  const kept = integrations.filter((entry) => entry.id !== options.integration.id);
  await replaceLocalText({
    filePath,
    previous,
    next: `${JSON.stringify({ version: 1, integrations: options.remove ? kept : [...kept, options.integration] }, null, 2)}\n`,
  });
}
