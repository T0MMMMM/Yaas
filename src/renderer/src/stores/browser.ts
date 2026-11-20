import { create } from 'zustand'
import type { BrowserState } from '@shared/ipc/contract'

interface BrowserStoreState {
  /** null until the first state arrives from main. */
  state: BrowserState | null
  /** Loads the browser state and keeps it in sync with main. Returns an unsubscribe. */
  init: () => () => void
}

export const useBrowser = create<BrowserStoreState>((set) => ({
  state: null,
  init: () => {
    let changed = false
    const off = window.acab.on('browser.changed', (state) => {
      changed = true
      set({ state })
    })
    // An event that lands while the first read is in flight is newer: keep it.
    void window.acab.invoke('browser.state').then((state) => {
      if (!changed) set({ state })
    })
    return off
  },
}))
