import os from "node:os";
import path from "node:path";
import { serveGuidedReview } from "@shadowclone/review";
import { runHostCommand } from "@shadowclone/core";

const usage =
  "Use shadowclone review open <review.html> [--checkout directory] [--engine claude|codex] [--voice file] [--review-skill file] [--model id] [--no-open].";

export function parseGuidedOpen(arguments_: readonly string[]) {
  const [file, ...rest] = arguments_;
  if (!file || file.startsWith("-")) throw new Error(usage);
  const flags = new Map<string, string>();
  let open = true;
  for (let position = 0; position < rest.length; position += 1) {
    const flag = rest[position];
    if (flag === "--no-open") {
      open = false;
      continue;
    }
    const value = rest[position + 1];
    if (
      !flag ||
      !["--checkout", "--engine", "--voice", "--review-skill", "--model"].includes(flag) ||
      !value ||
      value.startsWith("-") ||
      flags.has(flag)
    )
      throw new Error(usage);
    flags.set(flag, value);
    position += 1;
  }
  const engine = flags.get("--engine");
  if (engine !== undefined && engine !== "claude" && engine !== "codex") throw new Error(usage);
  const preferredEngine =
    engine === "claude"
      ? ("claude-code" as const)
      : engine === "codex"
        ? ("codex" as const)
        : undefined;
  return {
    file: path.resolve(file),
    checkout: path.resolve(flags.get("--checkout") ?? process.cwd()),
    preferredEngine,
    open,
    voiceFile: flags.get("--voice"),
    reviewSkill: flags.get("--review-skill"),
    model: flags.get("--model"),
  };
}

export async function openGuidedReview(arguments_: readonly string[]): Promise<void> {
  const options = parseGuidedOpen(arguments_);
  const defaultVoice = path.join(os.homedir(), ".agents", "voice.md");
  const voiceFile =
    options.voiceFile ?? ((await Bun.file(defaultVoice).exists()) ? defaultVoice : undefined);
  const server = await serveGuidedReview({ ...options, voiceFile });
  console.log("Guided review: " + server.url);
  console.log(
    "Opening the guide makes no model request. Select notes before creating a pending review.",
  );
  if (options.open && process.platform !== "win32") {
    const opened = await runHostCommand({
      arguments: [process.platform === "darwin" ? "open" : "xdg-open", server.url],
      cwd: process.cwd(),
    });
    if (opened.exitCode !== 0)
      console.error("The browser did not open. Use the local review link above.");
  }
  await new Promise<void>((resolve) => {
    const close = () => {
      server.stop();
      resolve();
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  });
}
