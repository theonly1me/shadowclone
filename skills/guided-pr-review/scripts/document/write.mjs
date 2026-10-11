import { writeFile } from "node:fs/promises";

export async function writeArtifact(options) {
  try {
    await writeFile(options.path, options.content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Output already exists: " + options.path + ". Choose a new output path to preserve it.",
      );
    throw error;
  }
}
