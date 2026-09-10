import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const ownedDirectoryMode = 0o700;
export const ownedFileMode = 0o600;

export async function ownedDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: ownedDirectoryMode });
  await chmod(directory, ownedDirectoryMode);
}

export async function ownedWrite(options: {
  readonly path: string;
  readonly content: string;
}): Promise<void> {
  const directory = path.dirname(options.path);
  await ownedDirectory(directory);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(options.path)}.${crypto.randomUUID()}.partial`,
  );
  await writeFile(temporaryPath, options.content, { mode: ownedFileMode });
  await chmod(temporaryPath, ownedFileMode);
  await rename(temporaryPath, options.path);
}

export async function ownedFile(filePath: string): Promise<void> {
  await chmod(filePath, ownedFileMode).catch(() => undefined);
}
