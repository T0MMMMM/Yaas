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
  /** The Settings section to show when Settings opens (the address bar's Design opens Appearance). */
  settingsSection: string | null
  openSettings: (section?: string) => void
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
  settingsSection: null,
  openSettings: (section) => set({ view: 'settings', settingsSection: section ?? null }),
  closeSettings: () => set({ view: 'browser' }),
  focusAddress: () => set(({ addressFocus }) => ({ addressFocus: addressFocus + 1 })),
  toggleHost: (host) =>
    set(({ collapsedHosts }) => {
      const { [host]: collapsed, ...rest } = collapsedHosts
      return { collapsedHosts: collapsed ? rest : { ...rest, [host]: true } }
    }),
  renameFolder: (renamingFolderId) => set({ renamingFolderId }),
}))
