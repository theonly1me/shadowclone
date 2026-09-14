import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import type { ProjectPaths } from "../../paths";
import { evaluationSuiteSchema } from "./receiptSchema";
import { fingerprint, parseJson } from "./structured";
import type { EvaluationSuite } from "./types";

function suitePath(options: {
  readonly paths: ProjectPaths;
  readonly suiteId: string;
}): string {
  const parsed = evaluationSuiteSchema.shape.suiteId.safeParse(options.suiteId);
  if (!parsed.success) {
    throw new Error("Invalid evaluation suite id");
  }
  return path.join(
    options.paths.shadowcloneDirectory,
    "eval-suites",
    `${parsed.data}.json`,
  );
}

export async function saveSuite(options: {
  readonly paths: ProjectPaths;
  readonly suite: EvaluationSuite;
}): Promise<void> {
  const destination = suitePath({
    paths: options.paths,
    suiteId: options.suite.suiteId,
  });
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
  await Bun.write(temporary, JSON.stringify(options.suite, null, 2), {
    mode: 0o600,
  });
  await rename(temporary, destination);
}

export async function loadSuite(options: {
  readonly paths: ProjectPaths;
  readonly suiteId: string;
}): Promise<EvaluationSuite> {
  const source = suitePath(options);
  if (!(await Bun.file(source).exists())) {
    throw new Error("Unknown evaluation suite id");
  }
  const parsed = evaluationSuiteSchema.safeParse(
    parseJson(await Bun.file(source).text()),
  );
  if (!parsed.success) {
    throw new Error("Unsupported evaluation suite");
  }
  for (const task of parsed.data.tasks) {
    if (task.profileFingerprint !== fingerprint(task.profile)) {
      throw new Error("Modified frozen evaluation suite");
    }
  }
  return parsed.data;
}
