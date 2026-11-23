import { describe, expect, it } from 'vitest'
import { resolveScheme } from './applyTheme'

describe('resolveScheme', () => {
  it('returns explicit light or dark regardless of OS preference', () => {
    expect(resolveScheme('light', true)).toBe('light')
    expect(resolveScheme('dark', false)).toBe('dark')
  })

  it('follows OS preference when set to system', () => {
    expect(resolveScheme('system', true)).toBe('dark')
    expect(resolveScheme('system', false)).toBe('light')
  })
})
