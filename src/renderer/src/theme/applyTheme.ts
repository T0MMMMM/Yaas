import type { AppInfo, Settings } from '@shared/ipc/contract'
import { onAccentColor } from './color'

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
  root.dataset['glass'] = settings.glass && info?.glassSupported ? 'on' : 'off'
  root.dataset['grain'] = settings.grain ? 'on' : 'off'
  if (info) root.dataset['platform'] = info.platform

  root.style.setProperty('--accent', settings.accent)
  root.style.setProperty('--on-accent', onAccentColor(settings.accent))
  root.style.setProperty('--grain-level', String(settings.grainOpacity))
}

export function onSystemSchemeChange(listener: () => void): () => void {
  darkQuery.addEventListener('change', listener)
  return () => darkQuery.removeEventListener('change', listener)
}
