import type { CSSProperties } from 'react'
import { hashUnit } from './hash'

/**
 * Each card gets its own tilt, stable per id, so a list never moves in lockstep:
 * hover −0.3…−1.1° or +0.3…+1.1°, selected a little more. The `askewCards` setting turns every
 * tilt off (tokens.css).
 */
export function tilt(id: string): CSSProperties {
  const sign = hashUnit(id, 7) < 0.5 ? -1 : 1
  const hover = sign * (0.3 + hashUnit(id, 1) * 0.8)
  const selected = sign * (0.6 + hashUnit(id, 2) * 0.9)
  return { '--tilt-hover': `${hover}deg`, '--tilt-selected': `${selected}deg` } as CSSProperties
}
