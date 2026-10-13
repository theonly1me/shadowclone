import type { Database } from "bun:sqlite";

export type OpencodeSchema = "v1" | "v2";

export type OpencodeSession = {
  readonly id: string;
  readonly directory: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly schema: OpencodeSchema;
  readonly signature: string;
};

type SessionRow = {
  readonly id: string;
  readonly directory: string;
  readonly createdAt: number;
  readonly rows: number;
  readonly updatedAt: number;
};

function hasTables(options: {
  readonly database: Database;
  readonly tables: readonly string[];
}): boolean {
  const query = options.database.query<{ readonly name: string }, [string]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  );

  return options.tables.every((table) => query.get(table) !== null);
}

function toSession(options: {
  readonly row: SessionRow;
  readonly schema: OpencodeSchema;
}): OpencodeSession {
  return {
    id: options.row.id,
    directory: options.row.directory,
    createdAt: options.row.createdAt,
    updatedAt: options.row.updatedAt,
    schema: options.schema,
    signature: `${options.schema}:${options.row.rows}:${options.row.updatedAt}`,
  };
}

function listVersionTwoSessions(database: Database): readonly OpencodeSession[] {
  return database
    .query<SessionRow, []>(
      `SELECT s.id AS id, s.directory AS directory, s.time_created AS createdAt,
         count(m.id) AS rows, coalesce(max(m.time_updated), 0) AS updatedAt
       FROM session_v2 s LEFT JOIN session_message m ON m.session_id = s.id
       WHERE s.parent_id IS NULL
       GROUP BY s.id
       ORDER BY s.time_created, s.id`,
    )
    .all()
    .map((row) => toSession({ row, schema: "v2" }));
}

function listVersionOneSessions(options: {
  readonly database: Database;
  readonly excludeVersionTwo: boolean;
}): readonly OpencodeSession[] {
  const excluded = options.excludeVersionTwo ? "AND s.id NOT IN (SELECT id FROM session_v2)" : "";

  return options.database
    .query<SessionRow, []>(
      `SELECT s.id AS id, s.directory AS directory, s.time_created AS createdAt,
         (SELECT count(*) FROM message m WHERE m.session_id = s.id) +
           (SELECT count(*) FROM part p WHERE p.session_id = s.id) AS rows,
         max(
           coalesce((SELECT max(m.time_updated) FROM message m WHERE m.session_id = s.id), 0),
           coalesce((SELECT max(p.time_updated) FROM part p WHERE p.session_id = s.id), 0)
         ) AS updatedAt
       FROM session s
       WHERE s.parent_id IS NULL ${excluded}
       ORDER BY s.time_created, s.id`,
    )
    .all()
    .map((row) => toSession({ row, schema: "v1" }));
}

export function listOpencodeSessions(database: Database): readonly OpencodeSession[] {
  const hasVersionTwo = hasTables({ database, tables: ["session_v2", "session_message"] });
  const hasVersionOne = hasTables({ database, tables: ["session", "message", "part"] });

  return [
    ...(hasVersionTwo ? listVersionTwoSessions(database) : []),
    ...(hasVersionOne
      ? listVersionOneSessions({ database, excludeVersionTwo: hasVersionTwo })
      : []),
  ];
}
