import { mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { record } from "./guard/records";

export async function restoreGuidance(options: {
  readonly encoded: string;
  readonly destination: string;
}): Promise<void> {
  if (Buffer.byteLength(options.encoded) > 48 * 1024) {
    throw new Error("Guidance exceeds its size limit.");
  }

  const decoded: unknown = JSON.parse(
    gunzipSync(Buffer.from(options.encoded, "base64"), {
      maxOutputLength: 8_000_000,
    }).toString(),
  );

  if (!Array.isArray(decoded)) {
    throw new Error("The guidance bundle is invalid.");
  }

  await mkdir(options.destination, { mode: 0o700 });

  for (const value of decoded) {
    const file = record(value);

    if (
      typeof file.path !== "string" ||
      !/^(?:native\.md|\.claude-plugin\/marketplace\.json|plugins\/shadowclone-personal\/[A-Za-z0-9_.\/-]+)$/.test(
        file.path,
      ) ||
      file.path.split("/").includes("..")
    ) {
      throw new Error("The guidance path is invalid.");
    }

    if (
      typeof file.content !== "string" ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(file.content) ||
      typeof file.mode !== "number" ||
      !Number.isInteger(file.mode) ||
      file.mode < 0 ||
      file.mode > 0o777
    ) {
      throw new Error("The guidance resource is invalid.");
    }

    const destination = path.join(options.destination, file.path);

    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });

    await writeFile(destination, Buffer.from(file.content, "base64"), {
      mode: file.mode,
      flag: "wx",
    });
  }
}
