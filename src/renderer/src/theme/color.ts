/** WCAG relative luminance of a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Invalid hex color: ${hex}`)
  const [r, g, b] = match.slice(1).map((part) => {
    const c = parseInt(part, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/** WCAG 2.1 contrast ratio (1..21) between two #RRGGBB colors. */
export function contrastRatio(aHex: string, bHex: string): number {
  return contrast(relativeLuminance(aHex), relativeLuminance(bHex))
}

/**
 * Text color on the accent (DESIGN.md §3.1 / §8): white whenever it reaches 3:1 (enough for the
 * short, bold labels that sit on accent — body text never does), otherwise black.
 */
export function onAccentColor(accent: string): '#000000' | '#ffffff' {
  return contrast(relativeLuminance(accent), 1) >= 3 ? '#ffffff' : '#000000'
}

export interface Hsv {
  /** 0..360 */
  h: number
  /** 0..1 */
  s: number
  /** 0..1 */
  v: number
}

export const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value)

export function hexToHsv(hex: string): Hsv {
  if (!isHex(hex)) throw new Error(`Invalid hex color: ${hex}`)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  let h = 0
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(f(5))}${hex(f(3))}${hex(f(1))}`.toUpperCase()
}

export interface Hsl {
  /** 0..360 */
  h: number
  /** 0..1 */
  s: number
  /** 0..1 */
  l: number
}

export function hexToHsl(hex: string): Hsl {
  const { h, s: sv, v } = hexToHsv(hex)
  const l = v * (1 - sv / 2)
  const s = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l)
  return { h, s, l }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const v = l + s * Math.min(l, 1 - l)
  return hsvToHex({ h, s: v === 0 ? 0 : 2 * (1 - l / v), v })
}
