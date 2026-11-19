import { describe, expect, it } from 'vitest'
import { onAccentColor, relativeLuminance } from './color'

describe('theme color helpers', () => {
  it('computes luminance at the extremes', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1)
  })

  it('picks a readable text color on the accent', () => {
    expect(onAccentColor('#7C5CFF')).toBe('#ffffff')
    expect(onAccentColor('#111111')).toBe('#ffffff')
    expect(onAccentColor('#FFE14D')).toBe('#000000')
  })

  it('rejects invalid colors', () => {
    expect(() => relativeLuminance('violet')).toThrow()
  })
})
