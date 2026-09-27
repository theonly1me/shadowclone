import path from "node:path";
import { z } from "zod";
import { readBoundedFile } from "../../io/files";
import type { ProjectPaths } from "../../paths";
import { ownedWrite } from "../../storage";
import { fingerprint } from "../transfer/structured";
import {
  receiptSchema,
  suiteSchema,
  type GuidanceReceipt,
  type GuidanceSuite,
} from "./schema";

export function guidanceDirectory(options: {
  readonly paths: ProjectPaths;
  readonly evalId: string;
}): string {
  return path.join(
    options.paths.shadowcloneDirectory,
    "eval",
    z.uuid().parse(options.evalId),
  );
}

export async function saveGuidanceReceipt(options: {
  readonly paths: ProjectPaths;
  readonly receipt: GuidanceReceipt;
}): Promise<void> {
  await ownedWrite({
    path: path.join(
      guidanceDirectory({
        paths: options.paths,
        evalId: options.receipt.evalId,
      }),
      "guidance-state.json",
    ),
    content: JSON.stringify(receiptSchema.parse(options.receipt), null, 2),
  });
}

export async function readGuidanceReceipt(options: {
  readonly paths: ProjectPaths;
  readonly evalId: string;
}): Promise<GuidanceReceipt> {
  const directory = guidanceDirectory(options);
  const text = await readBoundedFile({
    filePath: path.join(directory, "guidance-state.json"),
    roots: [directory],
    maximumBytes: 160 * 1024 * 1024,
  });

  if (text === null) {
    throw new Error("Guidance evaluation receipt is unavailable");
  }

  const receipt = receiptSchema.parse(JSON.parse(text));

  if (
    receipt.evalId !== options.evalId ||
    fingerprint(receipt.suite) !== receipt.suiteFingerprint
  ) {
    throw new Error("Guidance receipt fingerprint mismatch");
  }

  return receipt;
}

export async function saveGuidanceSuite(options: {
  readonly paths: ProjectPaths;
  readonly suite: GuidanceSuite;
}): Promise<void> {
  await ownedWrite({
    path: path.join(
      options.paths.shadowcloneDirectory,
      "eval-suites",
      `${options.suite.suiteId}.guidance.json`,
    ),
    content: JSON.stringify(
      { suite: options.suite, fingerprint: fingerprint(options.suite) },
      null,
      2,
    ),
  });
}

export async function readGuidanceSuite(options: {
  readonly paths: ProjectPaths;
  readonly suiteId: string;
}): Promise<GuidanceSuite> {
  const filePath = path.join(
    options.paths.shadowcloneDirectory,
    "eval-suites",
    `${z.uuid().parse(options.suiteId)}.guidance.json`,
  );
  const text = await readBoundedFile({
    filePath,
    roots: [options.paths.shadowcloneDirectory],
    maximumBytes: 160 * 1024 * 1024,
  });

  if (text === null) {
    throw new Error("Frozen guidance suite is unavailable");
  }

  const stored = z
    .strictObject({ suite: suiteSchema, fingerprint: z.string() })
    .parse(JSON.parse(text));

  if (
    stored.suite.suiteId !== options.suiteId ||
    fingerprint(stored.suite) !== stored.fingerprint
  ) {
    throw new Error("Frozen guidance suite fingerprint mismatch");
  }

  return stored.suite;
}
