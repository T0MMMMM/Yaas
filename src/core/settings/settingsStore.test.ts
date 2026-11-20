import { describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../store/database'
import { DEFAULT_SETTINGS, SettingsStore } from './settingsStore'

describe('SettingsStore', () => {
  it('starts from defaults without a database', () => {
    expect(new SettingsStore().get()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges patches and notifies subscribers until they unsubscribe', () => {
    const store = new SettingsStore()
    const listener = vi.fn()
    const off = store.subscribe(listener)

    store.update({ accent: '#2BB673' })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ accent: '#2BB673' }))

    off()
    store.update({ grain: 0 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('persists across instances on the same database', () => {
    const db = openDatabase(':memory:')
    new SettingsStore(db).update({ onboardingDone: true, sidebarWidth: 300 })
    expect(new SettingsStore(db).get()).toMatchObject({ onboardingDone: true, sidebarWidth: 300 })
  })

  it('drops stored values that are no longer valid, keeps the rest', () => {
    const db = openDatabase(':memory:')
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'app',
      JSON.stringify({ metersPlacement: 'topbar', accent: '#2BB673', removedOption: true }),
    )
    const settings = new SettingsStore(db).get()
    expect(settings.metersPlacement).toBe(DEFAULT_SETTINGS.metersPlacement)
    expect(settings.accent).toBe('#2BB673')
    expect(settings).not.toHaveProperty('removedOption')
  })

  it('defaults magneticButtons to true for a stored document without it', () => {
    const db = openDatabase(':memory:')
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'app',
      JSON.stringify({ accent: '#2BB673' }),
    )
    expect(new SettingsStore(db).get().magneticButtons).toBe(true)
  })
})
