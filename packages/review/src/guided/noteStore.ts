import { createHash } from "node:crypto";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import { ownedDirectory, ownedFile, ownedWrite } from "@shadowclone/core";
import { z } from "zod";
import { guidedNoteSchema } from "./schema";

const storedNoteSchema = guidedNoteSchema.extend({
  body: z.string().max(5000),
  selected: z.boolean(),
  dismissed: z.boolean(),
  reason: z.string().max(5000).optional(),
  verification: z.string().max(5000).optional(),
  counterevidence: z.string().max(5000).optional(),
  draftUrl: z.url().optional(),
});
const noteStateSchema = z.object({
  version: z.literal(1),
  reportId: z.string().regex(/^[a-f0-9]{64}$/),
  notes: z.array(storedNoteSchema).max(1000),
  progress: z.record(z.string(), z.boolean()),
  showProposals: z.boolean(),
});
const saveStateSchema = z.object({
  expectedFingerprint: z.string().nullable(),
  state: noteStateSchema,
});

export function guidedNoteStore(options: {
  readonly directory: string;
  readonly reportId: string;
  readonly prIds: readonly string[];
}) {
  const file = path.join(options.directory, "notes.json");
  const lock = path.join(options.directory, "notes.lock");
  const read = async () => {
    if (!(await Bun.file(file).exists())) return { fingerprint: null, state: null };
    await ownedFile(file);
    const text = await Bun.file(file).text();
    const state = noteStateSchema.parse(JSON.parse(text));
    if (state.reportId !== options.reportId)
      throw new Error("Saved notes belong to another report revision.");
    return { fingerprint: createHash("sha256").update(text).digest("hex"), state };
  };
  const save = async (input: unknown) => {
    const request = saveStateSchema.parse(input);
    if (
      request.state.reportId !== options.reportId ||
      request.state.notes.some((note) => !options.prIds.includes(note.pr))
    )
      throw new Error("Notes must stay within this report and its PRs.");
    await ownedDirectory(options.directory);
    const handle = await open(lock, "wx", 0o600).catch(() => {
      throw new Error(
        "Notes storage is locked. Export this copy and close other review windows before retrying.",
      );
    });
    try {
      const current = await read();
      if (current.fingerprint !== request.expectedFingerprint)
        throw new Error(
          "Saved notes changed in another view. Export this copy and reload before saving.",
        );
      await ownedWrite({ path: file, content: JSON.stringify(request.state) });
      return await read();
    } finally {
      await handle.close();
      await rm(lock);
    }
  };
  return { read, save };
}
