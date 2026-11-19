import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex, isHex, onAccentColor, relativeLuminance } from './color'

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

describe('hsv conversions', () => {
  it('round-trips hex → hsv → hex', () => {
    for (const hex of ['#7C5CFF', '#FF5C8A', '#2BB673', '#000000', '#FFFFFF', '#808080']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
  })

  it('maps pure hues to the wheel angle', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hexToHsv('#00FF00').h).toBe(120)
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000FF')
  })

  it('validates hex input', () => {
    expect(isHex('#a1b2c3')).toBe(true)
    expect(isHex('a1b2c3')).toBe(false)
    expect(isHex('#abc')).toBe(false)
  })
})
