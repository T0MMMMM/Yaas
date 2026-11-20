// The app was called ACAB before Big Browser. Its data folder and database file are named after
// the app, so on the first launch under the new name they are moved over once, keeping spaces,
// tabs, sign-ins and cookies.
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'

export const DB_FILE = 'big-browser.db'
const LEGACY_DATA_DIR = 'ACAB'
const LEGACY_DB_FILE = 'acab.db'
/** SQLite keeps its write-ahead log and shared memory next to the database. */
const DB_SUFFIXES = ['', '-wal', '-shm']

/**
 * Moves ACAB's data into `userData` unless Big Browser already has a database there. Entries that
 * already exist in `userData` (Electron may create a few before this runs) are left alone.
 */
export function migrateLegacyData(appData: string, userData: string): void {
  const legacyDir = join(appData, LEGACY_DATA_DIR)
  if (legacyDir !== userData && existsSync(legacyDir) && !existsSync(join(userData, DB_FILE))) {
    mkdirSync(userData, { recursive: true })
    for (const name of readdirSync(legacyDir)) {
      const target = join(userData, name)
      if (!existsSync(target)) renameSync(join(legacyDir, name), target)
    }
    if (readdirSync(legacyDir).length === 0) rmdirSync(legacyDir)
  }
  for (const suffix of DB_SUFFIXES) {
    const legacy = join(userData, LEGACY_DB_FILE + suffix)
    const current = join(userData, DB_FILE + suffix)
    if (existsSync(legacy) && !existsSync(current)) renameSync(legacy, current)
  }
}
