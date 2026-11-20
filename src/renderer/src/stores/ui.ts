import { create } from 'zustand'

/** Purely visual state of the window. Spaces and tabs come from main (stores/browser). */
interface UiState {
  view: 'browser' | 'settings'
  /** Bumped to ask the address bar to enter edit mode (⌘T, ⌘L, "New tab"). */
  addressFocus: number
  openSettings: () => void
  closeSettings: () => void
  focusAddress: () => void
}

export const useUi = create<UiState>((set) => ({
  view: 'browser',
  addressFocus: 0,
  openSettings: () => set({ view: 'settings' }),
  closeSettings: () => set({ view: 'browser' }),
  focusAddress: () => set(({ addressFocus }) => ({ addressFocus: addressFocus + 1 })),
}))
