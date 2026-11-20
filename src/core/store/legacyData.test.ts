import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DB_FILE, migrateLegacyData } from './legacyData'

let appData: string
let userData: string
let legacy: string

beforeEach(() => {
  appData = mkdtempSync(join(tmpdir(), 'big-browser-appdata-'))
  userData = join(appData, 'Big Browser')
  legacy = join(appData, 'ACAB')
})

afterEach(() => rmSync(appData, { recursive: true, force: true }))

function seedLegacy(): void {
  mkdirSync(join(legacy, 'Partitions', 'space-1'), { recursive: true })
  writeFileSync(join(legacy, 'acab.db'), 'db')
  writeFileSync(join(legacy, 'acab.db-wal'), 'wal')
  writeFileSync(join(legacy, 'Partitions', 'space-1', 'Cookies'), 'cookies')
}

describe('migrateLegacyData', () => {
  it('moves the ACAB folder and renames its database', () => {
    seedLegacy()
    migrateLegacyData(appData, userData)
    expect(readFileSync(join(userData, DB_FILE), 'utf8')).toBe('db')
    expect(readFileSync(join(userData, `${DB_FILE}-wal`), 'utf8')).toBe('wal')
    expect(readFileSync(join(userData, 'Partitions', 'space-1', 'Cookies'), 'utf8')).toBe('cookies')
    expect(existsSync(join(userData, 'acab.db'))).toBe(false)
    expect(existsSync(legacy)).toBe(false)
  })

  it('merges into a folder Electron already created, keeping its entries', () => {
    seedLegacy()
    mkdirSync(userData)
    writeFileSync(join(userData, 'lockfile'), 'new')
    migrateLegacyData(appData, userData)
    expect(readFileSync(join(userData, 'lockfile'), 'utf8')).toBe('new')
    expect(readFileSync(join(userData, DB_FILE), 'utf8')).toBe('db')
  })

  it('leaves ACAB alone once Big Browser has its own database', () => {
    seedLegacy()
    mkdirSync(userData)
    writeFileSync(join(userData, DB_FILE), 'current')
    migrateLegacyData(appData, userData)
    expect(readFileSync(join(userData, DB_FILE), 'utf8')).toBe('current')
    expect(existsSync(join(legacy, 'acab.db'))).toBe(true)
  })

  it('does nothing on a fresh install', () => {
    migrateLegacyData(appData, userData)
    expect(existsSync(userData)).toBe(false)
  })
})
