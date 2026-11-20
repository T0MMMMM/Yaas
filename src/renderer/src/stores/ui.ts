import { create } from 'zustand'

/** Purely visual state of the window. Spaces and tabs come from main (stores/browser). */
interface UiState {
  view: 'browser' | 'settings'
  /** Bumped to ask the address bar to enter edit mode (⌘T, ⌘L, "New tab"). */
  addressFocus: number
  /** Automatic folders the user closed, by host (they are derived, so not stored in main). */
  collapsedHosts: Record<string, true>
  /** The folder whose name the sidebar is editing ("New Folder…", "Rename"), or null. */
  renamingFolderId: string | null
  openSettings: () => void
  closeSettings: () => void
  focusAddress: () => void
  toggleHost: (host: string) => void
  renameFolder: (folderId: string | null) => void
}

export const useUi = create<UiState>((set) => ({
  view: 'browser',
  addressFocus: 0,
  collapsedHosts: {},
  renamingFolderId: null,
  openSettings: () => set({ view: 'settings' }),
  closeSettings: () => set({ view: 'browser' }),
  focusAddress: () => set(({ addressFocus }) => ({ addressFocus: addressFocus + 1 })),
  toggleHost: (host) =>
    set(({ collapsedHosts }) => {
      const { [host]: collapsed, ...rest } = collapsedHosts
      return { collapsedHosts: collapsed ? rest : { ...rest, [host]: true } }
    }),
  renameFolder: (renamingFolderId) => set({ renamingFolderId }),
}))
