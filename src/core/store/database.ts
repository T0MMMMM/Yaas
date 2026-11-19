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
]

export type Database = DatabaseSync

export const SCHEMA_VERSION = MIGRATIONS.length

/** Opens (or creates) the YAAS database and brings its schema up to date. `:memory:` for tests. */
export function openDatabase(file: string): Database {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}

function migrate(db: Database): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
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
