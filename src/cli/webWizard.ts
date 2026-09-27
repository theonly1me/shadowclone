import { canonicalPath, projectPaths } from "../paths";
import { serveBuildWizard } from "../web";

export async function runWebWizard(
  options: { readonly repository?: boolean; readonly open?: boolean } = {},
): Promise<void> {
  const wizard = serveBuildWizard({
    paths: projectPaths,
    cwd: canonicalPath(process.cwd()),
    scope: options.repository ? "private" : "global",
  });

  console.log(`Open your local skill tree: ${wizard.url}`);
  console.log("Keep this terminal open. Press Ctrl+C to close the editor.");

  const stop = () => {
    wizard.stop();
    process.exit(0);
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  if (options.open === false) {
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const executable = Bun.which(command);

  if (executable) {
    const child = Bun.spawn([executable, wizard.url], {
      stdout: "ignore",
      stderr: "ignore",
    });

    await child.exited;
  }
}
