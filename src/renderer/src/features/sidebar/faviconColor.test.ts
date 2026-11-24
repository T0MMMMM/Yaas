import { describe, expect, it } from 'vitest'
import { dominantColor } from './faviconColor'

function solidPixels(r: number, g: number, b: number, a = 255, count = 16): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(count * 4)
  for (let i = 0; i < count; i++) {
    buf[i * 4] = r
    buf[i * 4 + 1] = g
    buf[i * 4 + 2] = b
    buf[i * 4 + 3] = a
  }
  return buf
}

describe('dominantColor', () => {
  it('returns null for transparent or monochrome icons', () => {
    expect(dominantColor(solidPixels(255, 0, 0, 0))).toBeNull()
    expect(dominantColor(solidPixels(24, 24, 24, 255))).toBeNull()
    expect(dominantColor(solidPixels(248, 248, 248, 255))).toBeNull()
    expect(dominantColor(solidPixels(128, 130, 126, 255))).toBeNull()
  })

  it('extracts the dominant chromatic hue as a hex colour', () => {
    const blue = dominantColor(solidPixels(30, 120, 230, 255, 24))
    expect(blue).toMatch(/^#[0-9a-f]{6}$/)
    if (!blue) throw new Error('expected a colour')
    const r = Number.parseInt(blue.slice(1, 3), 16)
    const g = Number.parseInt(blue.slice(3, 5), 16)
    const b = Number.parseInt(blue.slice(5, 7), 16)
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
  })

  it('picks the most saturated winning hue when mixed with neutral background pixels', () => {
    const bg = solidPixels(255, 255, 255, 255, 20)
    const fg = solidPixels(230, 60, 50, 255, 8)
    const mixed = new Uint8ClampedArray(bg.length + fg.length)
    mixed.set(bg, 0)
    mixed.set(fg, bg.length)
    const picked = dominantColor(mixed)
    expect(picked).toMatch(/^#[0-9a-f]{6}$/)
    if (!picked) throw new Error('expected a colour')
    const r = Number.parseInt(picked.slice(1, 3), 16)
    const b = Number.parseInt(picked.slice(5, 7), 16)
    expect(r).toBeGreaterThan(b)
  })
})
