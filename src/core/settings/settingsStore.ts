import { settingsSchema, type Settings } from '@shared/ipc/contract'
import type { Database } from '../store/database'

export const DEFAULT_SETTINGS: Settings = {
  accent: '#7C5CFF',
  colorScheme: 'dark',
  glass: true,
  grain: true,
  grainOpacity: 0.08,
  spaceSwitcherStyle: 'emoji',
  metersPlacement: 'contextbar',
  sidebarWidth: 248,
  autoArchive: { enabled: false, afterDays: 14 },
  onboardingDone: false,
}

type Listener = (settings: Settings) => void

const KEY = 'app'

/**
 * App settings (theme, layout, onboarding state), persisted as one JSON document in the
 * `settings` table. Stored values that no longer validate (renamed option, removed value) fall
 * back to their default instead of breaking the app.
 */
export class SettingsStore {
  private settings: Settings
  private readonly listeners = new Set<Listener>()

  constructor(private readonly db: Database | null = null) {
    this.settings = { ...DEFAULT_SETTINGS, ...this.load() }
  }

  get(): Settings {
    return this.settings
  }

  update(patch: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...patch }
    this.save()
    for (const listener of this.listeners) listener(this.settings)
    return this.settings
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private load(): Partial<Settings> {
    if (!this.db) return {}
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as
      { value: string } | undefined
    if (!row) return {}
    let stored: unknown
    try {
      stored = JSON.parse(row.value)
    } catch {
      return {}
    }
    if (typeof stored !== 'object' || stored === null) return {}
    // Keep each stored field only if it is still valid on its own.
    const valid: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(stored)) {
      const field = settingsSchema.shape[key as keyof Settings]
      if (field?.safeParse(value).success) valid[key] = value
    }
    return valid as Partial<Settings>
  }

  private save(): void {
    this.db
      ?.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(KEY, JSON.stringify(this.settings))
  }
}
