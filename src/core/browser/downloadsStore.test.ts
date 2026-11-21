import { describe, expect, it } from 'vitest'
import { openDatabase } from '../store/database'
import { DownloadsStore } from './downloadsStore'

const sample = {
  url: 'https://example.com/a.pdf',
  path: '/d/a.pdf',
  filename: 'a.pdf',
  totalBytes: 100,
}

describe('DownloadsStore', () => {
  it('round-trips start, progress and finish', () => {
    const store = new DownloadsStore(openDatabase(':memory:'))
    const started = store.start(sample)
    expect(started).toMatchObject({ ...sample, receivedBytes: 0, state: 'progressing' })
    store.progress(started.id, 40, 120)
    expect(store.list()[0]).toMatchObject({ receivedBytes: 40, totalBytes: 120 })
    store.finish(started.id, 'completed')
    expect(store.list()[0]).toMatchObject({ state: 'completed' })
  })

  it('lists the newest first', () => {
    const store = new DownloadsStore(openDatabase(':memory:'))
    const first = store.start({ ...sample, filename: 'one' })
    const second = store.start({ ...sample, filename: 'two' })
    expect(store.list().map((d) => d.id)).toEqual([second.id, first.id])
  })

  it('clears the finished downloads and keeps a progressing one', () => {
    const store = new DownloadsStore(openDatabase(':memory:'))
    const done = store.start(sample)
    store.finish(done.id, 'completed')
    const failed = store.start(sample)
    store.finish(failed.id, 'interrupted')
    const running = store.start(sample)
    store.clear()
    expect(store.list().map((d) => d.id)).toEqual([running.id])
  })

  it('turns a download still progressing at startup into an interrupted one', () => {
    const db = openDatabase(':memory:')
    const running = new DownloadsStore(db).start(sample)
    const reopened = new DownloadsStore(db)
    expect(reopened.list()).toMatchObject([{ id: running.id, state: 'interrupted' }])
  })

  it('finds a download by id', () => {
    const store = new DownloadsStore(openDatabase(':memory:'))
    const d = store.start(sample)
    expect(store.get(d.id)?.path).toBe('/d/a.pdf')
    expect(store.get('nope')).toBeNull()
  })
})
