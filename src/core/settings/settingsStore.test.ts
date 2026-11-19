import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, SettingsStore } from './settingsStore'

describe('SettingsStore', () => {
  it('starts from defaults merged with initial values', () => {
    const store = new SettingsStore({ glass: false })
    expect(store.get()).toEqual({ ...DEFAULT_SETTINGS, glass: false })
  })

  it('merges patches and notifies subscribers until they unsubscribe', () => {
    const store = new SettingsStore()
    const listener = vi.fn()
    const off = store.subscribe(listener)

    store.update({ accent: '#2BB673' })
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ accent: '#2BB673', glass: true }),
    )

    off()
    store.update({ grain: false })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
