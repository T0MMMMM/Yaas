import { hexToHsl, hslToHex, isHex } from './color'

export type ColorScheme = 'light' | 'dark'

export interface FrameGradient {
  top: string
  bottom: string
}

type Rgb = readonly [number, number, number]

/** Warm neutral base behind the space tint (redesign direction §2). */
const FRAME_BASE: Record<ColorScheme, Rgb> = {
  light: [251, 250, 249], // #FBFAF9
  dark: [41, 41, 42], // #29292A
}

/** Blend weight of the space tint over the warm neutral base. */
const TINT_ALPHA: Record<ColorScheme, { colored: number; neutral: number }> = {
  light: { colored: 0.27, neutral: 0.09 },
  dark: { colored: 0.18, neutral: 0.06 },
}

/** Normalized HSL coordinates for the space tint (calm, uniform visual weight across hues). */
const TINT_SATURATION = 0.36
const TINT_LIGHTNESS = 0.527
const BOTTOM_LIGHTNESS_LIFT = 0.25

/** Colors below this HSL saturation are treated as neutral/achromatic spaces. */
const NEUTRAL_SATURATION_MAX = 0.08

const FALLBACK_COLOR = '#8E8E93'

function hexToRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbToHex([r, g, b]: Rgb): string {
  const channel = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function mixRgb(base: Rgb, overlay: Rgb, alpha: number): Rgb {
  return [
    base[0] * (1 - alpha) + overlay[0] * alpha,
    base[1] * (1 - alpha) + overlay[1] * alpha,
    base[2] * (1 - alpha) + overlay[2] * alpha,
  ]
}

/** Whether a hex color is near-achromatic and should use the weaker neutral tint weight. */
export function isNeutralSpaceColor(color: string): boolean {
  if (!isHex(color)) return true
  return hexToHsl(color).s < NEUTRAL_SATURATION_MAX
}

/**
 * Computes the vertical window-frame gradient stops from a space color and active scheme.
 * Light blends over `#FBFAF9` at 0.27 (0.09 for neutral spaces); dark blends over `#29292A`
 * at 0.18 (0.06 for neutral spaces). The bottom stop lifts tint lightness by +0.25.
 */
export function frameGradient(spaceColor: string, scheme: ColorScheme): FrameGradient {
  const safe = isHex(spaceColor) ? spaceColor : FALLBACK_COLOR
  const { h, s } = hexToHsl(safe)
  const neutral = s < NEUTRAL_SATURATION_MAX
  const tintSaturation = neutral ? 0 : TINT_SATURATION

  const topTint = hexToRgb(hslToHex({ h, s: tintSaturation, l: TINT_LIGHTNESS }))
  const bottomTint = hexToRgb(
    hslToHex({ h, s: tintSaturation, l: Math.min(1, TINT_LIGHTNESS + BOTTOM_LIGHTNESS_LIFT) }),
  )

  const base = FRAME_BASE[scheme]
  const alpha = neutral ? TINT_ALPHA[scheme].neutral : TINT_ALPHA[scheme].colored

  return {
    top: rgbToHex(mixRgb(base, topTint, alpha)),
    bottom: rgbToHex(mixRgb(base, bottomTint, alpha)),
  }
}
