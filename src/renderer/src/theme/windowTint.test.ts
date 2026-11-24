import { describe, expect, it } from 'vitest'
import { isHex, relativeLuminance } from './color'
import { frameGradient, isNeutralSpaceColor } from './windowTint'

describe('isNeutralSpaceColor', () => {
  it('treats greys, black, white, near-white, near-black and invalid values as neutral', () => {
    expect(isNeutralSpaceColor('#111111')).toBe(true)
    expect(isNeutralSpaceColor('#8E8E93')).toBe(true)
    expect(isNeutralSpaceColor('#FFFFFF')).toBe(true)
    expect(isNeutralSpaceColor('#F8F8FA')).toBe(true)
    expect(isNeutralSpaceColor('#F5F4F0')).toBe(true)
    expect(isNeutralSpaceColor('#0A0A0C')).toBe(true)
    expect(isNeutralSpaceColor('#141418')).toBe(true)
    expect(isNeutralSpaceColor('invalid')).toBe(true)
  })

  it('treats chromatic space colors as non-neutral', () => {
    expect(isNeutralSpaceColor('#7C5CFF')).toBe(false)
    expect(isNeutralSpaceColor('#2BB673')).toBe(false)
    expect(isNeutralSpaceColor('#FF8A3D')).toBe(false)
  })
})

describe('frameGradient', () => {
  it('produces a valid lighter-at-bottom vertical gradient in light and dark schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const grad = frameGradient('#7C5CFF', scheme)
      expect(isHex(grad.top)).toBe(true)
      expect(isHex(grad.bottom)).toBe(true)
      expect(relativeLuminance(grad.bottom)).toBeGreaterThan(relativeLuminance(grad.top))
    }
  })

  it('keeps light gradients bright and dark gradients deep for strong text contrast', () => {
    const light = frameGradient('#2BB673', 'light')
    const dark = frameGradient('#2BB673', 'dark')
    expect(relativeLuminance(light.top)).toBeGreaterThan(0.6)
    expect(relativeLuminance(dark.top)).toBeLessThan(0.1)
  })

  it('tints neutral spaces more weakly than chromatic spaces', () => {
    const lightChromatic = frameGradient('#7C5CFF', 'light')
    const lightNeutral = frameGradient('#8E8E93', 'light')
    const darkChromatic = frameGradient('#7C5CFF', 'dark')
    const darkNeutral = frameGradient('#8E8E93', 'dark')

    // Neutral stops sit closer to the warm base (#FBFAF9 / #29292A) than chromatic ones.
    expect(relativeLuminance(lightNeutral.top)).toBeGreaterThan(
      relativeLuminance(lightChromatic.top),
    )
    expect(
      Math.abs(relativeLuminance(darkNeutral.bottom) - relativeLuminance(darkNeutral.top)),
    ).toBeLessThan(
      Math.abs(relativeLuminance(darkChromatic.bottom) - relativeLuminance(darkChromatic.top)),
    )
  })

  it('produces distinct gradients for different space hues', () => {
    const violet = frameGradient('#7C5CFF', 'light')
    const green = frameGradient('#2BB673', 'light')
    const orange = frameGradient('#FF8A3D', 'light')
    expect(violet.top).not.toBe(green.top)
    expect(green.top).not.toBe(orange.top)
  })

  it('keeps near-white and near-black custom colors neutral instead of inflating hue tint', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const neutral = frameGradient('#8E8E93', scheme)
      expect(frameGradient('#F8F8FA', scheme)).toEqual(neutral)
      expect(frameGradient('#0A0A0C', scheme)).toEqual(neutral)
    }
  })

  it('falls back cleanly when given an invalid color string', () => {
    expect(frameGradient('not-a-hex', 'light')).toEqual(frameGradient('#8E8E93', 'light'))
  })
})
