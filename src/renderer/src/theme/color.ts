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

/**
 * Text color on the accent (DESIGN.md §3.1 / §8): white whenever it reaches 3:1 (enough for the
 * short, bold labels that sit on accent — body text never does), otherwise black.
 */
export function onAccentColor(accent: string): '#000000' | '#ffffff' {
  return contrast(relativeLuminance(accent), 1) >= 3 ? '#ffffff' : '#000000'
}
