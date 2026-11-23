import type { ComponentType, CSSProperties } from 'react'
import { ICONS, type IconName } from './icons'

export type IconComponent = ComponentType<{ size?: number; className?: string }>

export interface InkIconProps {
  name: IconName
  size?: number
  className?: string
}

/**
 * Renders a glyph from the "offset ink" set: a 24 px grid, a single off-register tinted fill
 * shape (`var(--tint-*)`), and a 1.6 px `currentColor` stroke.
 */
export function InkIcon({ name, size = 16, className }: InkIconProps) {
  const { tint, shape, ink } = ICONS[name]
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g style={{ fill: `var(--tint-${tint})` } as CSSProperties}>{shape}</g>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ink}
      </g>
    </svg>
  )
}
