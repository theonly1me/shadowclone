import path from "node:path";
import { changeFor, hookInputSchema, type HookContext } from "./hookChange";
import { liveId, surfaceFrom, type LiveRecord } from "./record";
import { readRecord, writeRecord } from "./store";
import { typeInbox } from "./typing";

export type { HookContext };

function parseInput(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function handleLiveHook(options: {
  readonly context: HookContext;
  readonly input: string;
}): Promise<Readonly<Record<string, unknown>> | null> {
  const { context } = options;
  const input = hookInputSchema.safeParse(parseInput(options.input));

  if (!input.success) {
    return null;
  }

  const id = liveId({ engine: context.engine, sessionId: input.data.session_id });
  const change = await changeFor({ context, input: input.data, id });

  if (change === null) {
    return null;
  }

  const existing = await readRecord({ paths: context.paths, id });
  const cwd = input.data.cwd ?? context.paths.home;
  const facts =
    existing === null || input.data.hook_event_name === "SessionStart"
      ? await context.gitFacts(cwd)
      : null;
  const now = context.now.toISOString();
  const base: LiveRecord = existing ?? {
    id,
    engine: context.engine,
    repository: path.basename(cwd),
    branch: null,
    folder: path.basename(cwd),
    state: "idle",
    startedAt: now,
    updatedAt: now,
    summary: "",
    attention: null,
    surface: surfaceFrom(context.environment),
  };

  const record: LiveRecord = {
    ...base,
    ...(facts === null
      ? {}
      : { repository: facts.repository ?? path.basename(cwd), branch: facts.branch }),
    ...change.record,
    updatedAt: now,
  };

  await writeRecord({ paths: context.paths, record });

  if (change.typeWaiting === true && record.surface !== null) {
    await typeInbox({
      paths: context.paths,
      id,
      surface: record.surface,
      typeText: context.typeText,
      now: context.now,
    });
  }

  return change.output;
}

export async function runLiveHook(options: {
  readonly enabled: () => Promise<boolean>;
  readonly context: HookContext;
  readonly input: string;
}): Promise<Readonly<Record<string, unknown>> | null> {
  if (!(await options.enabled().catch(() => false))) {
    return null;
  }

  return handleLiveHook(options).catch(() => null);
}
