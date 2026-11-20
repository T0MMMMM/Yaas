import { describe, expect, it } from 'vitest'
import { blocksAdsOn, withAdsBlockedOn } from './siteAdBlock'

const adBlock = { enabled: true, allowedHosts: ['a.com'] }

describe('blocksAdsOn', () => {
  it('blocks on a site unless it is allowed or blocking is off', () => {
    expect(blocksAdsOn(adBlock, 'b.com')).toBe(true)
    expect(blocksAdsOn(adBlock, 'a.com')).toBe(false)
    expect(blocksAdsOn({ ...adBlock, enabled: false }, 'b.com')).toBe(false)
  })
})

describe('withAdsBlockedOn', () => {
  it('adds the host to the allowed hosts to stop blocking on it', () => {
    expect(withAdsBlockedOn(adBlock, 'b.com', false)).toEqual({
      enabled: true,
      allowedHosts: ['a.com', 'b.com'],
    })
  })

  it('removes the host to block on it again', () => {
    expect(withAdsBlockedOn(adBlock, 'a.com', true)).toEqual({ enabled: true, allowedHosts: [] })
  })

  it('never lists a host twice', () => {
    expect(withAdsBlockedOn(adBlock, 'a.com', false).allowedHosts).toEqual(['a.com'])
  })
})
