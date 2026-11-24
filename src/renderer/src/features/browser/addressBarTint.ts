import type { CSSProperties } from 'react'
import { normalizeHexColor, readableTextOn } from '../../theme/color'

/**
 * Computes inline background and WCAG AA (>= 4.5:1) foreground text colors for an address bar
 * tinted by a site's `theme-color`. Returns `undefined` when the value is absent, translucent, or
 * cannot be normalized, so the bar keeps its neutral card surface.
 */
export function addressBarTint(themeColor: string | null | undefined): CSSProperties | undefined {
  if (!themeColor) return undefined
  const hex = normalizeHexColor(themeColor)
  if (!hex) return undefined
  return {
    backgroundColor: hex,
    color: readableTextOn(hex),
  }
}
