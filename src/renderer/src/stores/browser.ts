import { create } from 'zustand'
import type { BrowserState } from '@shared/ipc/contract'

interface BrowserStoreState {
  /** null until the first state arrives from main. */
  state: BrowserState | null
  /** The ratio a split divider drag shows before it is stored, or null (see useWorkspace). */
  splitPreview: number | null
  /** Loads the browser state and keeps it in sync with main. Returns an unsubscribe. */
  init: () => () => void
}

export const useBrowser = create<BrowserStoreState>((set) => ({
  state: null,
  splitPreview: null,
  init: () => {
    let changed = false
    const offChanged = window.bigBrowser.on('browser.changed', (state) => {
      changed = true
      set({ state })
    })
    const offPreview = window.bigBrowser.on('browser.splitPreview', (splitPreview) =>
      set({ splitPreview }),
    )
    // An event that lands while the first read is in flight is newer: keep it.
    void window.bigBrowser.invoke('browser.state').then((state) => {
      if (!changed) set({ state })
    })
    return () => {
      offChanged()
      offPreview()
    }
  },
}))
