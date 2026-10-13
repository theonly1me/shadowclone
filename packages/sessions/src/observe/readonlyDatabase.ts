import { Database, constants } from "bun:sqlite";
import { pathToFileURL } from "node:url";

export function openReadonlyDatabase(sourcePath: string): Database {
  let primary: Database | null = null;

  try {
    primary = new Database(sourcePath, {
      readonly: true,
      strict: true,
    });
    primary.query("SELECT 1").get();

    return primary;
  } catch {
    primary?.close();

    let fallback: Database | null = null;

    try {
      fallback = new Database(
        `${pathToFileURL(sourcePath).href}?mode=ro&immutable=1`,
        constants.SQLITE_OPEN_READONLY | constants.SQLITE_OPEN_URI,
      );
      fallback.query("SELECT 1").get();

      return fallback;
    } catch (error) {
      fallback?.close();

      throw error;
    }
  }
}
