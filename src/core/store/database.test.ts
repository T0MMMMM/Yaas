import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { migrate, openDatabase, SCHEMA_VERSION } from './database'

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
      'history',
    ])
  })

  it('migrates a v4 database to v5 keeping its rows, new columns null or 0', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrate(db, 4)
    db.exec(
      `INSERT INTO spaces (id, name, color, position, active_tab_id, created_at)
         VALUES ('s', 'Personal', '#7C5CFF', 0, 't', 'now');
       INSERT INTO folders (id, space_id, name, position, collapsed, created_at)
         VALUES ('f', 's', 'Reading', 0, 1, 'now');
       INSERT INTO tabs (id, space_id, url, title, favicon_url, position, created_at, section,
           folder_id, parent_id)
         VALUES ('t', 's', 'a', 'A', NULL, 0, 'now', 'pinned', 'f', NULL);`,
    )
    migrate(db, 5)
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 5 })
    expect(db.prepare('SELECT id, name, icon, section_collapsed FROM spaces').all()).toEqual([
      { id: 's', name: 'Personal', icon: null, section_collapsed: 0 },
    ])
    expect(db.prepare('SELECT id, name, collapsed, parent_id, icon FROM folders').all()).toEqual([
      { id: 'f', name: 'Reading', collapsed: 1, parent_id: null, icon: null },
    ])
    expect(db.prepare('SELECT id, folder_id, last_active_at FROM tabs').all()).toEqual([
      { id: 't', folder_id: 'f', last_active_at: null },
    ])
  })

  it('deleting a folder row cascades its child folders', () => {
    const db = openDatabase(':memory:')
    db.exec(
      `INSERT INTO spaces (id, name, color, position, active_tab_id, created_at)
         VALUES ('s', 'Personal', '#7C5CFF', 0, NULL, 'now');
       INSERT INTO folders (id, space_id, name, position, collapsed, created_at, parent_id)
         VALUES ('p', 's', 'P', 0, 0, 'now', NULL), ('c', 's', 'C', 0, 0, 'now', 'p');
       DELETE FROM folders WHERE id = 'p';`,
    )
    expect(db.prepare('SELECT COUNT(*) AS n FROM folders').get()).toEqual({ n: 0 })
  })

  it('is idempotent when reopened', () => {
    const dir = mkdtempSync(join(tmpdir(), 'big-browser-db-'))
    dirs.push(dir)
    const file = join(dir, 'big-browser.db')
    openDatabase(file).close()
    const db = openDatabase(file)
    expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: SCHEMA_VERSION })
    db.close()
  })
})
