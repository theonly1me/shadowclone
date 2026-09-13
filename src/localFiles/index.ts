import { lstatSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

export function fingerprint(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

export function assertRegularDestination(filePath: string): void {
  let current = path.resolve(filePath);
  for (;;) {
    const metadata = lstatSync(current, { throwIfNoEntry: false });
    if (metadata?.isSymbolicLink() || (current === path.resolve(filePath) && metadata && !metadata.isFile())) {
      throw new Error("Destination must be a regular file without symbolic links");
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export async function readLocalText(filePath: string): Promise<string | null> {
  assertRegularDestination(filePath);
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  if (file.size > 2_000_000) throw new Error("Local file exceeds the supported size");
  return file.text();
}

export async function replaceLocalText(options: {
  readonly filePath: string;
  readonly previous: string | null;
  readonly next: string | null;
}): Promise<void> {
  if (await readLocalText(options.filePath) !== options.previous) {
    throw new Error("Destination changed during the update; retry after reviewing it");
  }
  if (options.next === options.previous) return;
  if (options.next === null) {
    await rm(options.filePath, { force: true });
    return;
  }
  await mkdir(path.dirname(options.filePath), { recursive: true });
  const temporary = `${options.filePath}.${crypto.randomUUID()}.tmp`;
  try {
    const mode = lstatSync(options.filePath, { throwIfNoEntry: false })?.mode;
    await Bun.write(temporary, options.next, { mode: mode === undefined ? 0o600 : mode & 0o777 });
    if (await readLocalText(options.filePath) !== options.previous) {
      throw new Error("Destination changed during the update; retry after reviewing it");
    }
    await rename(temporary, options.filePath);
  } finally {
    await rm(temporary, { force: true });
  }
}
