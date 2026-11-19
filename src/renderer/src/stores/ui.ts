import { create } from 'zustand'

/** Purely visual state of the window (active space / session, collapsed groups). */
interface UiState {
  activeSpaceId: string
  activeSessionId: string | null
  collapsedEnvironments: ReadonlySet<string>
  setSpace: (id: string) => void
  openSession: (id: string) => void
  toggleEnvironment: (id: string) => void
}

export const useUi = create<UiState>((set) => ({
  activeSpaceId: 'work',
  activeSessionId: null,
  collapsedEnvironments: new Set(),
  setSpace: (activeSpaceId) => set({ activeSpaceId, activeSessionId: null }),
  openSession: (activeSessionId) => set({ activeSessionId }),
  toggleEnvironment: (id) =>
    set(({ collapsedEnvironments }) => {
      const next = new Set(collapsedEnvironments)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { collapsedEnvironments: next }
    }),
}))
