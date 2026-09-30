import { Command } from "commander";
import { z } from "zod";
import { readLocalText } from "../localFiles";
import { projectPaths } from "../paths";
import { runTaskOperation } from "../tasks/operations";
import {
  readTaskGrant,
  setTaskGrant,
  taskActionSchema,
  reconcileTask,
  type TaskContext,
} from "../tasks";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";

const usage =
  "task start|status|list|checkpoint|verify|pause|resume|cancel|action|maintain|reconcile [id] [--input <json-file|->]; task grants|grant <comma-separated-actions>|revoke";

export async function taskCommandLine(options: {
  readonly arguments: readonly string[];
  readonly context?: TaskContext;
  readonly confirm?: ConfirmPrompt;
  readonly writeLine?: (text: string) => void;
}): Promise<void> {
  const output = options.writeLine ?? console.log;
  if (options.arguments.length === 0 || options.arguments.includes("--help")) {
    output(usage);
    return;
  }
  const program = new Command()
    .name("shadowclone task")
    .exitOverride()
    .argument("<operation>")
    .argument("[id]")
    .option("--input <file>")
    .option("--sessions-stopped")
    .option("--not-applied <action-id>");
  program.parse([...options.arguments], { from: "user" });
  const [operation, id] = program.args;
  const flags = z
    .strictObject({
      input: z.string().optional(),
      sessionsStopped: z.boolean().optional(),
      notApplied: z.uuid().optional(),
    })
    .parse(program.opts());
  const context = options.context ?? {
    cwd: process.cwd(),
    paths: projectPaths,
  };
  const confirm = options.confirm ?? promptConfirmation;
  if (
    operation === "grants" ||
    operation === "grant" ||
    operation === "revoke"
  ) {
    const current = await readTaskGrant(context);
    if (operation === "grants") {
      output(JSON.stringify(current.grant));
      return;
    }
    const actions =
      operation === "revoke"
        ? []
        : z.array(taskActionSchema).min(1).parse(id?.split(","));
    if (operation === "grant") {
      output(
        JSON.stringify({
          repository: current.repository.repository.id,
          actions,
        }),
      );
      if (!options.confirm && !process.stdin.isTTY)
        throw new Error(
          "Repository grants require the owner's interactive terminal confirmation",
        );
      if (
        !(await confirm(
          "Save these repository action grants? Tasks can narrow them and you can revoke them at any time.",
        ))
      )
        return;
    }
    output(JSON.stringify(await setTaskGrant({ ...context, actions })));
    return;
  }
  if (operation === "reconcile" && flags.notApplied && id) {
    if (!options.confirm && !process.stdin.isTTY)
      throw new Error(
        "Confirm an unapplied action in the owner's interactive terminal",
      );
    if (
      !(await confirm(
        `Record action ${flags.notApplied} as not applied after inspecting its effects?`,
      ))
    )
      return;
    output(
      JSON.stringify(
        await reconcileTask({
          ...context,
          id,
          notAppliedActionId: flags.notApplied,
        }),
      ),
    );
    return;
  }
  const text =
    flags.input === "-"
      ? await Bun.stdin.text()
      : flags.input
        ? await readLocalText(flags.input)
        : null;
  if (text !== null && Buffer.byteLength(text) > 2_000_000)
    throw new Error("Task input exceeds the size limit");
  const input: unknown = text === null ? undefined : JSON.parse(text);
  const request = {
    operation,
    ...(id ? { id } : {}),
    ...(input === undefined ? {} : { input }),
    ...(flags.sessionsStopped === undefined
      ? {}
      : { sessionsStopped: flags.sessionsStopped }),
  };
  output(
    JSON.stringify(await runTaskOperation({ ...context, request }), null, 2),
  );
}
