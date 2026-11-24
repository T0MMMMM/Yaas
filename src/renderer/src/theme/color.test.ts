import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  hexToHsl,
  hexToHsv,
  hslToHex,
  hsvToHex,
  isHex,
  normalizeHexColor,
  onAccentColor,
  readableTextOn,
  relativeLuminance,
} from './color'

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

  it('picks black or white with >= 4.5:1 WCAG AA contrast on any surface', () => {
    for (const bg of [
      '#123456',
      '#F5F5F0',
      '#7C5CFF',
      '#2D9CDB',
      '#2BB673',
      '#FF8A3D',
      '#767676',
    ]) {
      const fg = readableTextOn(bg)
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
    }
    expect(readableTextOn('#123456')).toBe('#ffffff')
    expect(readableTextOn('#F5F5F0')).toBe('#000000')
    // Mid-tones where 3:1 would allow white (< 4.5:1) pick black instead.
    expect(readableTextOn('#7C5CFF')).toBe('#000000')
    expect(readableTextOn('#2D9CDB')).toBe('#000000')
  })

  it('normalizes hex, rgb(), rgba(), and CSS named colors and rejects translucent/unknown ones', () => {
    expect(normalizeHexColor('#123456')).toBe('#123456')
    expect(normalizeHexColor(' #aBc ')).toBe('#AABBCC')
    expect(normalizeHexColor('rgb(18, 52, 86)')).toBe('#123456')
    expect(normalizeHexColor('rgb(18 52 86)')).toBe('#123456')
    expect(normalizeHexColor('rgba(18, 52, 86, 1)')).toBe('#123456')
    expect(normalizeHexColor('rgb(100% 0% 50% / 100%)')).toBe('#FF0080')
    expect(normalizeHexColor('navy')).toBe('#000080')
    expect(normalizeHexColor('RebeccaPurple')).toBe('#663399')

    expect(normalizeHexColor('rgba(18, 52, 86, 0.5)')).toBeNull()
    expect(normalizeHexColor('rgb(18 52 86 / 0.8)')).toBeNull()
    expect(normalizeHexColor('transparent')).toBeNull()
    expect(normalizeHexColor('hsl(200 50% 50%)')).toBeNull()
    expect(normalizeHexColor('not-a-color')).toBeNull()
    expect(normalizeHexColor('')).toBeNull()
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

describe('hsl conversions', () => {
  it('round-trips hex → hsl → hex', () => {
    for (const hex of ['#7C5CFF', '#14B8C4', '#F2C94C', '#111111']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex)
    }
  })
})
