import { createElement } from 'react'
import { InkIcon, type IconComponent } from './InkIcon'
import type { IconName } from './icons'

/** Adapts an "offset ink" icon name into a component compatible with `Settings`. */
export function inkIcon(name: IconName): IconComponent {
  return function InkGlyph({ size, className }) {
    return createElement(InkIcon, { name, size, className })
  }
}
