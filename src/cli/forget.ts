import { rm } from "node:fs/promises";
import { projectPaths } from "../paths";

export async function forgetAll(
  shadowcloneDirectory = projectPaths.shadowcloneDirectory,
): Promise<void> {
  await rm(shadowcloneDirectory, { recursive: true, force: true });
  console.log("Removed all shadowclone data.");
}
