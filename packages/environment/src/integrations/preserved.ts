export const preservedFileMessages = {
  editedManagedContent: "shadowclone managed content was edited; preserving the file",
  untrackedManagedContent: "Untracked shadowclone content already exists; preserving the file",
  invalidHookConfiguration: "Invalid native hook configuration; preserving the file",
  editedHooks: "Integration hooks were edited; preserving the file",
  editedIntegrationFile: "Integration skill or extension was edited or already exists; preserving it",
} as const;

export type PreservedReason = keyof typeof preservedFileMessages;

export class PreservedFileError extends Error {
  readonly reason: PreservedReason;
  readonly filePath: string | null;

  constructor(options: { readonly reason: PreservedReason; readonly filePath?: string }) {
    super(preservedFileMessages[options.reason]);
    this.reason = options.reason;
    this.filePath = options.filePath ?? null;
  }
}

export function preservedAt<Result>(options: {
  readonly filePath: string;
  readonly prepare: () => Result;
}): Result {
  try {
    return options.prepare();
  } catch (error) {
    if (error instanceof PreservedFileError && error.filePath === null) {
      throw new PreservedFileError({ reason: error.reason, filePath: options.filePath });
    }

    throw error;
  }
}
