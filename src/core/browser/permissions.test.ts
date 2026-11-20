import { describe, expect, it } from 'vitest'
import { isPermissionGranted } from './permissions'

describe('isPermissionGranted', () => {
  it.each(['clipboard-sanitized-write', 'fullscreen', 'pointerLock'])('grants %s', (permission) => {
    expect(isPermissionGranted(permission)).toBe(true)
  })

  it.each([
    'media',
    'geolocation',
    'notifications',
    'clipboard-read',
    'openExternal',
    'hid',
    'unknown',
  ])('denies %s', (permission) => {
    expect(isPermissionGranted(permission)).toBe(false)
  })
})
