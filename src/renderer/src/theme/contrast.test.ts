import { describe, expect, it } from 'vitest'
import { contrastRatio } from './color'
import { frameGradient, type ColorScheme } from './windowTint'

/** The 8 ColorPicker presets plus neutral/extreme custom space colors. */
const SPACE_PRESETS = [
  '#7C5CFF',
  '#FF5C8A',
  '#FF8A3D',
  '#F2C94C',
  '#2BB673',
  '#14B8C4',
  '#2D9CDB',
  '#111111',
  '#8E8E93',
  '#F8F8FA',
  '#0A0A0C',
] as const

const WCAG_AA = 4.5

/** Mirrors the scheme text and surface tokens declared in `tokens.css`. */
const SCHEME_TOKENS: Record<
  ColorScheme,
  {
    text: string
    textMuted: string
    textSecondary: string
    textFaint: string
    textPlaceholder: string
    neutralSurface: string
    bgMenu: string
  }
> = {
  light: {
    text: '#1c1c1e',
    textMuted: 'rgb(0 0 0 / 0.65)',
    textSecondary: 'rgb(0 0 0 / 0.58)',
    textFaint: 'rgb(0 0 0 / 0.58)',
    textPlaceholder: 'rgb(0 0 0 / 0.58)',
    neutralSurface: '#ffffff',
    bgMenu: '#ffffff',
  },
  dark: {
    text: '#f5f5f7',
    textMuted: 'rgb(255 255 255 / 0.7)',
    textSecondary: 'rgb(255 255 255 / 0.62)',
    textFaint: 'rgb(255 255 255 / 0.6)',
    textPlaceholder: 'rgb(255 255 255 / 0.6)',
    neutralSurface: '#1c1c1e',
    bgMenu: '#2c2c2e',
  },
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Composites an opaque hex or `rgb(r g b / a)` CSS color over an opaque hex background. */
function compositeOver(cssColor: string, bgHex: string): string {
  if (/^#[0-9a-f]{6}$/i.test(cssColor)) return cssColor
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([0-9.]+)\s*\)$/.exec(cssColor)
  if (!rgb) throw new Error(`Unsupported token color format: ${cssColor}`)
  const fg: [number, number, number] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  const alpha = Number(rgb[4])
  const bg = hexToRgb(bgHex)
  return rgbToHex([
    bg[0] * (1 - alpha) + fg[0] * alpha,
    bg[1] * (1 - alpha) + fg[1] * alpha,
    bg[2] * (1 - alpha) + fg[2] * alpha,
  ])
}

describe('theme text contrast (WCAG AA >= 4.5:1)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const tokens = SCHEME_TOKENS[scheme]

    it(`meets AA for --text, --text-muted, --text-secondary and --text-faint across all presets in ${scheme} mode`, () => {
      const checks: ReadonlyArray<readonly [string, string]> = [
        ['--text', tokens.text],
        ['--text-muted', tokens.textMuted],
        ['--text-secondary', tokens.textSecondary],
        ['--text-faint', tokens.textFaint],
      ]
      for (const preset of SPACE_PRESETS) {
        const { top, bottom } = frameGradient(preset, scheme)
        for (const [name, raw] of checks) {
          for (const [stop, bg] of [
            ['top', top],
            ['bottom', bottom],
          ] as const) {
            const ratio = contrastRatio(compositeOver(raw, bg), bg)
            expect(
              ratio,
              `${scheme} ${name} (${raw}) on ${preset} ${stop} (${bg})`,
            ).toBeGreaterThanOrEqual(WCAG_AA)
          }
        }
      }
    })

    it(`meets AA for --text-faint and --text-placeholder on the page card and menu in ${scheme} mode`, () => {
      const checks: ReadonlyArray<readonly [string, string]> = [
        ['--text-faint', tokens.textFaint],
        ['--text-placeholder', tokens.textPlaceholder],
      ]
      for (const [name, raw] of checks) {
        for (const [surfaceName, bg] of [
          ['--neutral-surface', tokens.neutralSurface],
          ['--bg-menu', tokens.bgMenu],
        ] as const) {
          const ratio = contrastRatio(compositeOver(raw, bg), bg)
          expect(
            ratio,
            `${scheme} ${name} (${raw}) on ${surfaceName} (${bg})`,
          ).toBeGreaterThanOrEqual(WCAG_AA)
        }
      }
    })
  }
})
