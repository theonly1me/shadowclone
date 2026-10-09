import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import product from "./product.json";

export type SeedDirectories = {
  readonly preferences: string;
  readonly skills: string;
};

const packageManifestSchema = z.object({ name: z.string() });

async function isDirectory(directory: string): Promise<boolean> {
  return stat(directory)
    .then((metadata) => metadata.isDirectory())
    .catch(() => false);
}

export async function isPackageRoot(rootDirectory: string): Promise<boolean> {
  const manifest = Bun.file(path.join(rootDirectory, "package.json"));
  const parsed = packageManifestSchema.safeParse(
    (await manifest.exists()) ? await manifest.json().catch(() => null) : null,
  );

  return (
    parsed.success &&
    parsed.data.name === product.name &&
    (await isDirectory(path.join(rootDirectory, "skills"))) &&
    (await isDirectory(path.join(rootDirectory, "preferences")))
  );
}

export async function resolveSeedDirectories(): Promise<SeedDirectories> {
  const packageRoot = path.resolve(import.meta.dir, "..");

  if (await isPackageRoot(packageRoot)) {
    return {
      preferences: path.join(packageRoot, "preferences"),
      skills: path.join(packageRoot, "skills"),
    };
  }

  throw new Error("The packaged seed guidance directories are missing");
}

export async function seedSkillsDirectory(): Promise<string> {
  return (await resolveSeedDirectories()).skills;
}
