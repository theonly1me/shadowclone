import path from "node:path";
import { readdir } from "node:fs/promises";
import { assertRegularDestination } from "../localFiles";
import { acquireLocalLock } from "../localFiles/lock";
import { ownedDirectory, ownedFile, ownedWrite } from "../storage";
import type { ProjectPaths } from "../paths";
import { taskIdSchema, taskRecordSchema, type TaskRecord } from "./schema";

export async function withTaskLock<Result>(options: {
  readonly paths: ProjectPaths;
  readonly run: () => Promise<Result>;
}): Promise<Result> {
  await ownedDirectory(options.paths.shadowcloneDirectory);
  const filePath = path.join(
    options.paths.shadowcloneDirectory,
    "task-write.db",
  );
  let lock = await acquireLocalLock(filePath);
  for (let attempt = 0; lock === null && attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    lock = await acquireLocalLock(filePath);
  }
  if (!lock)
    throw new Error(
      "Another task operation is running; retry after it finishes",
    );
  try {
    await ownedFile(filePath);
    return await options.run();
  } finally {
    lock.release();
  }
}

export async function readTask(options: {
  readonly paths: ProjectPaths;
  readonly id: string;
}): Promise<TaskRecord> {
  const filePath = path.join(
    options.paths.runDirectory(taskIdSchema.parse(options.id)),
    "task.json",
  );
  assertRegularDestination(filePath);
  const file = Bun.file(filePath);
  if (!(await file.exists())) throw new Error("Task was not found");
  if (file.size > 16_000_000)
    throw new Error("Task record exceeds the size limit");
  const record = taskRecordSchema.parse(await file.json());
  if (record.id !== options.id)
    throw new Error("Task identity does not match its storage");
  return record;
}

export async function withTaskOperationLock<Result>(options: {
  readonly paths: ProjectPaths;
  readonly id: string;
  readonly run: () => Promise<Result>;
}): Promise<Result> {
  const directory = options.paths.runDirectory(taskIdSchema.parse(options.id));
  await ownedDirectory(directory);
  const filePath = path.join(directory, "operation.db");
  const lock = await acquireLocalLock(filePath);
  if (!lock)
    throw new Error(
      "A task operation is still running; pause it and wait for it to stop before resuming",
    );
  try {
    await ownedFile(filePath);
    return await options.run();
  } finally {
    lock.release();
  }
}

export async function writeTask(options: {
  readonly paths: ProjectPaths;
  readonly task: TaskRecord;
}): Promise<TaskRecord> {
  const task = taskRecordSchema.parse({
    ...options.task,
    revision: options.task.revision + 1,
    updatedAt: new Date().toISOString(),
  });
  const content = `${JSON.stringify(task, null, 2)}\n`;
  if (Buffer.byteLength(content) > 16_000_000)
    throw new Error("Task record exceeds the size limit");
  await ownedWrite({
    path: path.join(options.paths.runDirectory(task.id), "task.json"),
    content,
  });
  return task;
}

export async function listTasks(
  paths: ProjectPaths,
): Promise<readonly TaskRecord[]> {
  const entries = await readdir(paths.runsDirectory, {
    withFileTypes: true,
  }).catch(() => []);
  const tasks: TaskRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !taskIdSchema.safeParse(entry.name).success)
      continue;
    const filePath = path.join(paths.runDirectory(entry.name), "task.json");
    if (await Bun.file(filePath).exists())
      tasks.push(await readTask({ paths, id: entry.name }));
  }
  return tasks.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}
