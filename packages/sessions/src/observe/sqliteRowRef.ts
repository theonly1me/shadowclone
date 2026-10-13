import type { Database } from "bun:sqlite";
import { maximumTextBytes } from "@shadowclone/core";
import { openReadonlyDatabase } from "./readonlyDatabase";

const sqliteRowTables = ["part", "session_message"] as const;

type SqliteRowTable = (typeof sqliteRowTables)[number];

export type SqliteRowTextRef = {
  readonly type: "sqlite-row";
  readonly sourcePath: string;
  readonly table: SqliteRowTable;
  readonly rowId: string;
  readonly jsonPath: readonly (string | number)[];
};

function isSqliteRowTable(value: unknown): value is SqliteRowTable {
  return sqliteRowTables.some((table) => table === value);
}

function isJsonPathPart(part: unknown): part is string | number {
  return (
    (typeof part === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) ||
    (typeof part === "number" && Number.isSafeInteger(part) && part >= 0)
  );
}

function isJsonPath(value: unknown): value is readonly (string | number)[] {
  return (
    Array.isArray(value) && value.length > 0 && value.length <= 32 && value.every(isJsonPathPart)
  );
}

export function parseSqliteRowTextRef(options: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly sourcePath: string;
}): SqliteRowTextRef | null {
  const { table, rowId, jsonPath } = options.value;

  if (
    !isSqliteRowTable(table) ||
    typeof rowId !== "string" ||
    rowId.length === 0 ||
    rowId.length > 512 ||
    !isJsonPath(jsonPath)
  ) {
    return null;
  }

  return {
    type: "sqlite-row",
    sourcePath: options.sourcePath,
    table,
    rowId,
    jsonPath,
  };
}

function sqliteJsonPath(jsonPath: readonly (string | number)[]): string {
  return `$${jsonPath.map((part) => (typeof part === "number" ? `[${part}]` : `.${part}`)).join("")}`;
}

export function readSqliteRowText(ref: SqliteRowTextRef): string {
  let database: Database | null = null;

  try {
    database = openReadonlyDatabase(ref.sourcePath);

    const jsonPath = sqliteJsonPath(ref.jsonPath);
    const row = database
      .query<{ readonly text: unknown }, [string, string, string, number]>(
        `SELECT json_extract(data, ?) AS text FROM ${ref.table}
         WHERE id = ? AND length(CAST(json_extract(data, ?) AS BLOB)) <= ?`,
      )
      .get(jsonPath, ref.rowId, jsonPath, maximumTextBytes);

    return typeof row?.text === "string" ? row.text : "";
  } catch {
    return "";
  } finally {
    database?.close();
  }
}
