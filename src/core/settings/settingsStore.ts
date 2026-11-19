import type { Settings } from '@shared/ipc/contract'

export const DEFAULT_SETTINGS: Settings = {
  accent: '#7C5CFF',
  colorScheme: 'system',
  glass: true,
  grain: true,
  grainOpacity: 0.08,
  spaceSwitcherStyle: 'emoji',
  metersPlacement: 'contextbar',
  autoArchive: { enabled: false, afterDays: 14 },
  onboardingDone: false,
}

type Listener = (settings: Settings) => void

/**
 * App settings (theme + onboarding state). In-memory for now; persistence (SQLite `settings`
 * table) comes with the store module.
 */
export class SettingsStore {
  private settings: Settings
  private readonly listeners = new Set<Listener>()

  constructor(initial: Partial<Settings> = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...initial }
  }

  get(): Settings {
    return this.settings
  }

  update(patch: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...patch }
    for (const listener of this.listeners) listener(this.settings)
    return this.settings
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
