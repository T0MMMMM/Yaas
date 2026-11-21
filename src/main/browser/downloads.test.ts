import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { DownloadItem, Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { DownloadsStore } from '@core/browser/downloadsStore'
import { openDatabase } from '@core/store/database'
import { Downloads, PROGRESS_THROTTLE_MS } from './downloads'

class FakeItem extends EventEmitter {
  received = 0
  savePath = ''
  constructor(private readonly name: string) {
    super()
  }
  getFilename = () => this.name
  getURL = () => 'https://example.com/' + this.name
  getTotalBytes = () => 100
  getReceivedBytes = () => this.received
  setSavePath = (path: string) => {
    this.savePath = path
  }
}

function setup(caseInsensitive = false) {
  let time = 0
  const changes = vi.fn()
  const downloads = new Downloads({
    store: new DownloadsStore(openDatabase(':memory:')),
    directory: () => 'dl',
    exists: () => false,
    onChange: changes,
    now: () => time,
    caseInsensitive,
  })
  const ses = new EventEmitter()
  downloads.attach(ses as unknown as Session)
  const start = (name: string) => {
    const item = new FakeItem(name)
    ses.emit('will-download', {}, item as unknown as DownloadItem)
    return item
  }
  return { downloads, changes, start, ses, tick: (ms: number) => (time += ms) }
}

describe('Downloads', () => {
  it('saves to the folder without asking, and records the finish', () => {
    const { downloads, start } = setup()
    const item = start('a.pdf')
    expect(item.savePath).toBe(join('dl', 'a.pdf'))
    expect(downloads.list()[0]).toMatchObject({ filename: 'a.pdf', state: 'progressing' })
    item.received = 100
    item.emit('done', {}, 'completed')
    expect(downloads.list()[0]).toMatchObject({ state: 'completed', receivedBytes: 100 })
  })

  it('records a cancelled download as interrupted', () => {
    const { downloads, start } = setup()
    start('a.pdf').emit('done', {}, 'cancelled')
    expect(downloads.list()[0]?.state).toBe('interrupted')
  })

  it('gives two simultaneous downloads of one name different files', () => {
    const { start } = setup()
    expect(start('a.pdf').savePath).toBe(join('dl', 'a.pdf'))
    expect(start('a.pdf').savePath).toBe(join('dl', 'a (1).pdf'))
  })

  it('on a case-insensitive disk, never gives A.pdf and a.pdf the same file', () => {
    const { start } = setup(true)
    expect(start('A.pdf').savePath).toBe(join('dl', 'A.pdf'))
    expect(start('a.pdf').savePath).toBe(join('dl', 'a (1).pdf'))
  })

  it('frees a name once its download is done, whatever its case', () => {
    const { start } = setup(true)
    start('A.pdf').emit('done', {}, 'completed')
    expect(start('a.pdf').savePath).toBe(join('dl', 'a.pdf'))
  })

  it('throttles progress to one event per 250 ms', () => {
    const { changes, start, tick } = setup()
    const item = start('a.pdf')
    changes.mockClear()
    item.emit('updated', {}, 'progressing')
    expect(changes).not.toHaveBeenCalled()
    tick(PROGRESS_THROTTLE_MS)
    item.received = 30
    item.emit('updated', {}, 'progressing')
    item.emit('updated', {}, 'progressing')
    expect(changes).toHaveBeenCalledTimes(1)
  })

  it('names the row after the saved file', () => {
    const { downloads, start } = setup()
    start('a.pdf')
    start('a.pdf')
    expect(downloads.list().map((d) => d.filename)).toEqual(['a (1).pdf', 'a.pdf'])
  })

  it('hooks a session once', () => {
    const { downloads, ses, start } = setup()
    downloads.attach(ses as unknown as Session)
    start('a.pdf')
    expect(downloads.list()).toHaveLength(1)
  })
})
