import path from "node:path";
import { canonicalPath, projectPaths } from "../paths";
import { ownedWrite } from "../storage";
import { exportGuidance } from "../cloud/export";
import { cloneStatus } from "../cloud/status";
import { runWebWizard } from "./webWizard";

export async function botCommand(arguments_: readonly string[]): Promise<void> {
  const [operation, ...rest] = arguments_;

  if (operation === "status" && rest.length === 0) {
    console.log(JSON.stringify(await cloneStatus(projectPaths), null, 2));
    return;
  }

  if (operation === "setup") {
    const targetIndex = rest.indexOf("--repo");
    const target = targetIndex < 0 ? undefined : rest[targetIndex + 1];
    const valid =
      targetIndex < 0
        ? rest
        : rest.filter((_, index) => index !== targetIndex && index !== targetIndex + 1);

    if (
      (targetIndex >= 0 && !target?.match(/^[\w.-]+\/[\w.-]+$/)) ||
      valid.some((value) => value !== "--no-open")
    ) {
      throw new Error("Use shadowclone bot setup [--repo owner/repository] [--no-open].");
    }

    await runWebWizard({ bot: true, targetRepository: target, open: !rest.includes("--no-open") });
    return;
  }

  if (operation === "export") {
    const skills: string[] = [];
    let destination: string | null = null;

    for (let position = 0; position < rest.length; position += 2) {
      const flag = rest[position];
      const value = rest[position + 1];

      if (!value || !["--skill", "--output"].includes(flag ?? "")) {
        throw new Error(
          "Use shadowclone bot export --skill shadowclone-work [--skill name] --output " + "file.",
        );
      }

      if (flag === "--skill") {
        skills.push(value);
      }

      if (flag === "--output") {
        destination = value;
      }
    }

    if (!destination) {
      throw new Error("Choose a private output file outside the repository checkout.");
    }

    const cwd = canonicalPath(process.cwd());
    const output = canonicalPath(destination);
    const relative = path.relative(cwd, output);

    if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
      throw new Error("The guidance output must stay outside the repository checkout.");
    }

    const delivery = await exportGuidance({ paths: projectPaths, cwd, skills });
    await ownedWrite({ path: output, content: delivery.encoded });
    console.log(
      JSON.stringify(
        {
          output,
          skills: delivery.skills,
          bytes: Buffer.byteLength(delivery.encoded),
          fingerprint: delivery.fingerprint,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("shadowclone bot setup [--repo owner/repository] [--no-open]");
  console.log(
    "shadowclone bot export --skill shadowclone-work [--skill name] --output " + "private-file",
  );
  console.log("shadowclone bot status");
}
