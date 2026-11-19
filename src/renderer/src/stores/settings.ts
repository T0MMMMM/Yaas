import { create } from 'zustand'
import type { AppInfo, Settings } from '@shared/ipc/contract'

interface SettingsState {
  info: AppInfo | null
  settings: Settings | null
  /** Loads app info + settings and keeps them in sync with main. Returns an unsubscribe. */
  init: () => () => void
  update: (patch: Partial<Settings>) => Promise<void>
}

export const useSettings = create<SettingsState>((set) => ({
  info: null,
  settings: null,
  init: () => {
    void Promise.all([window.yaas.invoke('app.info'), window.yaas.invoke('settings.get')]).then(
      ([info, settings]) => set({ info, settings }),
    )
    return window.yaas.on('settings.changed', (settings) => set({ settings }))
  },
  update: async (patch) => {
    const settings = await window.yaas.invoke('settings.update', patch)
    set({ settings })
  },
}))
