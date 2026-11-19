import { create } from 'zustand'

/** Purely visual state of the window (active space / session, view, open folders). */
interface UiState {
  /** null = the first space. */
  activeSpaceId: string | null
  activeSessionId: string | null
  view: 'session' | 'settings'
  closedEnvironments: ReadonlySet<string>
  setSpace: (id: string) => void
  openSession: (id: string) => void
  openSettings: () => void
  closeSettings: () => void
  toggleEnvironment: (id: string) => void
}

export const useUi = create<UiState>((set) => ({
  activeSpaceId: null,
  activeSessionId: null,
  view: 'session',
  closedEnvironments: new Set(['website']),
  setSpace: (activeSpaceId) => set({ activeSpaceId, activeSessionId: null, view: 'session' }),
  openSession: (activeSessionId) => set({ activeSessionId, view: 'session' }),
  openSettings: () => set({ view: 'settings' }),
  closeSettings: () => set({ view: 'session' }),
  toggleEnvironment: (id) =>
    set(({ closedEnvironments }) => {
      const next = new Set(closedEnvironments)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { closedEnvironments: next }
    }),
}))
