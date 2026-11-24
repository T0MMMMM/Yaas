import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../theme/color'
import { addressBarTint } from './addressBarTint'

describe('addressBarTint', () => {
  it('returns undefined when themeColor is absent or unsupported', () => {
    expect(addressBarTint(null)).toBeUndefined()
    expect(addressBarTint(undefined)).toBeUndefined()
    expect(addressBarTint('')).toBeUndefined()
    expect(addressBarTint('transparent')).toBeUndefined()
    expect(addressBarTint('rgba(18, 52, 86, 0.5)')).toBeUndefined()
    expect(addressBarTint('hsl(210 50% 40%)')).toBeUndefined()
    expect(addressBarTint('not-a-color')).toBeUndefined()
  })

  it('normalizes hex, rgb(), and named theme colors and ensures >= 4.5:1 text contrast', () => {
    const darkHex = addressBarTint('#123456')
    expect(darkHex).toEqual({ backgroundColor: '#123456', color: '#ffffff' })

    const lightHex = addressBarTint('#f5f5f0')
    expect(lightHex).toEqual({ backgroundColor: '#F5F5F0', color: '#000000' })

    const rgb = addressBarTint('rgb(18, 52, 86)')
    expect(rgb).toEqual({ backgroundColor: '#123456', color: '#ffffff' })

    const named = addressBarTint('navy')
    expect(named).toEqual({ backgroundColor: '#000080', color: '#ffffff' })

    const midTone = addressBarTint('#2D9CDB')
    expect(midTone).toEqual({ backgroundColor: '#2D9CDB', color: '#000000' })
    expect(
      contrastRatio(midTone?.color as string, midTone?.backgroundColor as string),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
