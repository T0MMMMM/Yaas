import type { AppInfo, Settings } from '@shared/ipc/contract'
import { onAccentColor } from './color'

/** Transparency from which the UI switches to the liquid glass look. */
export const LIQUID_FROM = 0.9

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

/** Maps settings to <html> data attributes and CSS variables (DESIGN.md §3). */
export function applyTheme(settings: Settings, info: AppInfo | null): void {
  const root = document.documentElement
  const scheme =
    settings.colorScheme === 'system'
      ? darkQuery.matches
        ? 'dark'
        : 'light'
      : settings.colorScheme

  root.dataset['scheme'] = scheme
  const transparency = info?.glassSupported ? settings.transparency : 0
  // off → see-through → liquid (the top of the transparency range, DESIGN.md §4)
  root.dataset['glass'] = transparency === 0 ? 'off' : transparency >= LIQUID_FROM ? 'liquid' : 'on'
  root.style.setProperty('--transparency', String(transparency))
  root.style.setProperty('--grain', String(settings.grain))
  if (info) root.dataset['platform'] = info.platform

  root.style.setProperty('--accent', settings.accent)
  root.style.setProperty('--on-accent', onAccentColor(settings.accent))
}

export function onSystemSchemeChange(listener: () => void): () => void {
  darkQuery.addEventListener('change', listener)
  return () => darkQuery.removeEventListener('change', listener)
}
