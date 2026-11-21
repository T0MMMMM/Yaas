import { describe, expect, it } from 'vitest'
import { formatBytes, fraction } from './format'

describe('formatBytes', () => {
  it('scales to the unit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(812)).toBe('812 B')
    expect(formatBytes(1400)).toBe('1.4 KB')
    expect(formatBytes(25_000_000)).toBe('25 MB')
  })
})

describe('fraction', () => {
  it('is null while the size is unknown and capped at 1', () => {
    expect(fraction(10, 0)).toBeNull()
    expect(fraction(50, 200)).toBe(0.25)
    expect(fraction(300, 200)).toBe(1)
  })
})
