import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, SCHEMA_VERSION } from './database'

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('openDatabase', () => {
  it('migrates a new database to the latest schema', () => {
    const db = openDatabase(':memory:')
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: SCHEMA_VERSION })
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    expect(tables.map((t) => (t as { name: string }).name)).toEqual([
      'settings',
      'accounts',
      'spaces',
      'tabs',
      'folders',
    ])
  })

  it('is idempotent when reopened', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acab-db-'))
    dirs.push(dir)
    const file = join(dir, 'acab.db')
    openDatabase(file).close()
    const db = openDatabase(file)
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: SCHEMA_VERSION })
    db.close()
  })
})
