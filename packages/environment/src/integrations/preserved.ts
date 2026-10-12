export const preservedFileMessages = {
  editedManagedContent: "shadowclone managed content was edited; preserving the file",
  untrackedManagedContent: "Untracked shadowclone content already exists; preserving the file",
  invalidHookConfiguration: "Invalid native hook configuration; preserving the file",
  editedHooks: "Integration hooks were edited; preserving the file",
  editedIntegrationFile: "Integration skill or extension was edited or already exists; preserving it",
} as const;

const messages: ReadonlySet<string> = new Set(Object.values(preservedFileMessages));

export function isPreservedFileError(error: unknown): boolean {
  return error instanceof Error && messages.has(error.message);
}
