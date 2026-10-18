import {
  cloneDetailLines,
  cloneListLine,
  clonesPaths,
  containerLog,
  localNode,
  startText,
  stopText,
} from "@shadowclone/clones";
import { flagValue } from "./cloneOptions";

export const cloneControlUsage =
  "clone start --repo owner/repository [--issue <number> | --pull <number> | --review <number>] [task]; clone list [--repo owner/repository]; clone show|stop|logs <id>";

const valueFlags = ["--repo", "--issue", "--pull", "--review"];

function numberFlag(options: {
  readonly arguments: readonly string[];
  readonly flag: string;
}): number | undefined {
  const value = flagValue(options);

  if (value === null) {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${options.flag} needs a positive number.`);
  }

  return number;
}

function taskText(arguments_: readonly string[]): string {
  return arguments_
    .filter((argument, index) => {
      const previous = arguments_[index - 1];

      return !valueFlags.includes(argument) && (previous === undefined || !valueFlags.includes(previous));
    })
    .join(" ");
}

async function start(arguments_: readonly string[]): Promise<void> {
  const repository = flagValue({ arguments: arguments_, flag: "--repo" });
  const review = numberFlag({ arguments: arguments_, flag: "--review" });
  const issue = numberFlag({ arguments: arguments_, flag: "--issue" });
  const pull = review ?? numberFlag({ arguments: arguments_, flag: "--pull" });

  if (repository === null || repository === "") {
    throw new Error(`Use shadowclone ${cloneControlUsage}.`);
  }

  const outcome = await localNode({ paths: clonesPaths() }).start({
    repository,
    task: taskText(arguments_),
    ...(issue === undefined ? {} : { issue }),
    ...(pull === undefined ? {} : { pull }),
    review: review !== undefined,
  });

  console.log(startText(outcome));
  process.exitCode = outcome.kind === "queued" ? 0 : 1;
}

async function list(arguments_: readonly string[]): Promise<void> {
  const repository = flagValue({ arguments: arguments_, flag: "--repo" });
  const { clones, unreadable } = await localNode({ paths: clonesPaths() }).list(
    repository === null ? {} : { repository },
  );

  console.log(clones.length === 0 ? "No clones on this machine." : clones.map(cloneListLine).join("\n"));

  if (unreadable.length > 0) {
    console.log(`These run folders could not be read: ${unreadable.join(", ")}`);
    process.exitCode = 1;
  }
}

function requireId(arguments_: readonly string[]): string {
  const [id] = arguments_;

  if (id === undefined) {
    throw new Error(`Use shadowclone ${cloneControlUsage}.`);
  }

  return id;
}

async function show(arguments_: readonly string[]): Promise<void> {
  const id = requireId(arguments_);
  const clone = await localNode({ paths: clonesPaths() }).get(id);

  if (clone === null) {
    console.log(`No clone ${id} exists on this machine.`);
    process.exitCode = 1;
    return;
  }

  console.log(cloneDetailLines(clone).join("\n"));
}

async function stop(arguments_: readonly string[]): Promise<void> {
  const id = requireId(arguments_);
  const outcome = await localNode({ paths: clonesPaths() }).stop(id);

  console.log(stopText({ id, outcome }));
  process.exitCode = outcome.kind === "unknown" ? 1 : 0;
}

async function logs(arguments_: readonly string[]): Promise<void> {
  const [requested] = arguments_;
  const id =
    requested ?? (await localNode({ paths: clonesPaths() }).list({})).clones.at(0)?.id ?? null;

  if (id === null) {
    console.log("No clone has run on this machine yet.");
    return;
  }

  const file = Bun.file(containerLog({ paths: clonesPaths(), id }));

  if (!(await file.exists())) {
    console.log(`Clone ${id} has no log yet.`);
    return;
  }

  console.log(`${file.name}\n${(await file.text()).split("\n").slice(-200).join("\n")}`);
}

export const controlOperations: Readonly<
  Record<string, (arguments_: readonly string[]) => Promise<void>>
> = { start, list, show, stop, logs };
