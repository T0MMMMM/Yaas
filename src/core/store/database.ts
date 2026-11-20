import { DatabaseSync } from 'node:sqlite'

/**
 * Ordered schema migrations. Never edit one that has shipped: append a new one.
 * The number of applied migrations is stored in `PRAGMA user_version`.
 */
const MIGRATIONS: string[] = [
  // 1 — key/value settings (one JSON document per key)
  `CREATE TABLE settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  // 2 — accounts (ADR-0002: config_dir NULL = the default ~/.claude)
  `CREATE TABLE accounts (
     id           TEXT PRIMARY KEY,
     provider     TEXT NOT NULL,
     label        TEXT NOT NULL,
     emoji        TEXT NOT NULL,
     color        TEXT NOT NULL,
     config_dir   TEXT UNIQUE,
     auth_method  TEXT NOT NULL,
     email        TEXT,
     org_name     TEXT,
     plan         TEXT,
     position     INTEGER NOT NULL,
     created_at   TEXT NOT NULL,
     archived_at  TEXT
   )`,
  // 3 — browser spaces and tabs (the active space lives in settings under `browser.activeSpace`)
  `CREATE TABLE spaces (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, position INTEGER NOT NULL,
     active_tab_id TEXT, created_at TEXT NOT NULL
   );
   CREATE TABLE tabs (
     id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
     url TEXT NOT NULL, title TEXT NOT NULL, favicon_url TEXT, position INTEGER NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE INDEX tabs_space ON tabs(space_id, position);`,
  // 4 — sections, folders and nested tabs (whether a tab is loaded is runtime state, not stored)
  `CREATE TABLE folders (
     id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
     name TEXT NOT NULL, position INTEGER NOT NULL, collapsed INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   );
   CREATE INDEX folders_space ON folders(space_id, position);
   ALTER TABLE tabs ADD COLUMN section TEXT NOT NULL DEFAULT 'today';
   ALTER TABLE tabs ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;
   ALTER TABLE tabs ADD COLUMN parent_id TEXT;`,
]

export type Database = DatabaseSync

export const SCHEMA_VERSION = MIGRATIONS.length

/** Opens (or creates) the ACAB database and brings its schema up to date. `:memory:` for tests. */
export function openDatabase(file: string): Database {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}

/** Applies the pending migrations, up to `target` (all of them by default; tests stop earlier). */
export function migrate(db: Database, target = MIGRATIONS.length): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let version = row.user_version; version < target; version++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[version] as string)
      db.exec(`PRAGMA user_version = ${version + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
