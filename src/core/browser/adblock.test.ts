import { describe, expect, it, vi } from 'vitest'
import {
  CACHE_MAX_AGE_MS,
  diffAllowed,
  diffHosts,
  exceptionFilters,
  hostOf,
  isCacheStale,
  loadEngine,
} from './adblock'

describe('exceptionFilters', () => {
  it('allows the requests and the element hiding of the pages of a host', () => {
    expect(exceptionFilters('example.com')).toEqual([
      '@@*$domain=example.com',
      '@@||example.com^$elemhide',
    ])
  })
})

describe('hostOf', () => {
  it('returns the lower-cased hostname of a web URL', () => {
    expect(hostOf('https://WWW.Example.com/a')).toBe('www.example.com')
    expect(hostOf('http://127.0.0.1:8080/with-ad')).toBe('127.0.0.1')
  })

  it('returns null for anything else', () => {
    expect(hostOf('about:blank')).toBeNull()
    expect(hostOf('chrome-extension://abc/page.html')).toBeNull()
    expect(hostOf('not a url')).toBeNull()
  })
})

describe('diffHosts', () => {
  it('lists the hosts added and removed', () => {
    expect(diffHosts(['a.com', 'c.com'], ['c.com', 'b.com'])).toEqual({
      added: ['b.com'],
      removed: ['a.com'],
    })
  })
})

describe('diffAllowed', () => {
  it('turns the added and removed hosts into filters', () => {
    expect(diffAllowed(['a.com'], ['b.com'])).toEqual({
      added: exceptionFilters('b.com'),
      removed: exceptionFilters('a.com'),
    })
  })

  it('is empty when nothing changed', () => {
    expect(diffAllowed(['a.com'], ['a.com'])).toEqual({ added: [], removed: [] })
  })
})

describe('isCacheStale', () => {
  const now = Date.parse('2026-11-20T12:00:00Z')

  it('keeps a cache up to 7 days old', () => {
    expect(isCacheStale(now - CACHE_MAX_AGE_MS, now)).toBe(false)
    expect(isCacheStale(now - 60_000, now)).toBe(false)
  })

  it('refreshes a cache older than 7 days', () => {
    expect(CACHE_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(isCacheStale(now - CACHE_MAX_AGE_MS - 1, now)).toBe(true)
  })
})

describe('loadEngine', () => {
  it('returns what the loader resolves', async () => {
    await expect(loadEngine(() => Promise.resolve('engine'), vi.fn())).resolves.toBe('engine')
  })

  it('logs a failure (offline) and returns null', async () => {
    const log = vi.fn()
    const error = new Error('fetch failed')
    await expect(loadEngine(() => Promise.reject(error), log)).resolves.toBeNull()
    expect(log).toHaveBeenCalledWith(expect.any(String), error)
  })
})
