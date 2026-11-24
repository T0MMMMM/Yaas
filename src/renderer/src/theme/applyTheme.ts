import { DEFAULT_ACCENT, type AppInfo, type Settings } from '@shared/ipc/contract'
import { isHex, onAccentColor } from './color'
import { frameGradient, type ColorScheme } from './windowTint'

export interface StyleRoot {
  style: Pick<CSSStyleDeclaration, 'setProperty'>
}

/** Transparency from which the UI switches to the liquid glass look. */
export const LIQUID_FROM = 0.9

const darkQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

/** Resolves `settings.colorScheme` ('system' | 'light' | 'dark') against the OS media query. */
export function resolveScheme(
  colorScheme: Settings['colorScheme'],
  prefersDark: boolean = darkQuery?.matches ?? false,
): ColorScheme {
  if (colorScheme === 'system') return prefersDark ? 'dark' : 'light'
  return colorScheme
}

/** Maps settings to <html> data attributes and CSS variables (DESIGN.md §3). */
export function applyTheme(settings: Settings, info: AppInfo | null): void {
  const root = document.documentElement
  const scheme = resolveScheme(settings.colorScheme)

  root.dataset['scheme'] = scheme
  const transparency = info?.glassSupported ? settings.transparency : 0
  // off → see-through → liquid (the top of the transparency range, DESIGN.md §4)
  root.dataset['glass'] = transparency === 0 ? 'off' : transparency >= LIQUID_FROM ? 'liquid' : 'on'
  root.style.setProperty('--transparency', String(transparency))
  root.style.setProperty('--grain', String(settings.grain))
  root.dataset['askew'] = settings.askewCards ? 'on' : 'off'
  root.dataset['magnetic'] = settings.magneticButtons ? 'on' : 'off'
  root.dataset['contextbar'] = settings.contextBarStyle
  if (info) root.dataset['platform'] = info.platform

  root.style.setProperty('--accent', settings.accent)
  root.style.setProperty('--on-accent', onAccentColor(settings.accent))

  const { top, bottom } = frameGradient(settings.accent, scheme)
  root.style.setProperty('--frame-top', top)
  root.style.setProperty('--frame-bottom', bottom)
}

/**
 * Applies the active space's accent color on `root` (defaults to `document.documentElement`) so
 * derived custom properties (`--space-accent-soft`, `--bg-dock-selected`, `--selection-bg`)
 * resolve against it everywhere rather than inheriting `:root`'s `--accent`.
 */
export function applySpaceAccent(color: string, root: StyleRoot = document.documentElement): void {
  const safe = isHex(color) ? color : DEFAULT_ACCENT
  root.style.setProperty('--space-accent', safe)
  root.style.setProperty('--space-accent-soft', `color-mix(in srgb, ${safe} 12%, transparent)`)
  root.style.setProperty('--bg-dock-selected', `color-mix(in srgb, ${safe} 12%, transparent)`)
  root.style.setProperty('--selection-bg', `color-mix(in srgb, ${safe} 22%, transparent)`)
}

export function onSystemSchemeChange(listener: () => void): () => void {
  if (!darkQuery) return () => undefined
  darkQuery.addEventListener('change', listener)
  return () => darkQuery.removeEventListener('change', listener)
}
