import { create } from 'zustand'
import type { Download } from '@shared/model'

interface DownloadsState {
  /** Every space's downloads, newest first. */
  list: Download[]
  /** Loads the list and keeps it in sync with main. Returns an unsubscribe. */
  init: () => () => void
}

export const useDownloads = create<DownloadsState>((set) => ({
  list: [],
  init: () => {
    let changed = false
    const off = window.bigBrowser.on('downloads.changed', (list) => {
      changed = true
      set({ list })
    })
    // An event that lands while the first read is in flight is newer: keep it.
    void window.bigBrowser.invoke('downloads.list').then((list) => {
      if (!changed) set({ list })
    })
    return off
  },
}))
