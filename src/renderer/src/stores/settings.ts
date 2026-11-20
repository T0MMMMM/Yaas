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
    void Promise.all([
      window.bigBrowser.invoke('app.info'),
      window.bigBrowser.invoke('settings.get'),
    ]).then(([info, settings]) => set({ info, settings }))
    return window.bigBrowser.on('settings.changed', (settings) => set({ settings }))
  },
  update: async (patch) => {
    const settings = await window.bigBrowser.invoke('settings.update', patch)
    set({ settings })
  },
}))
