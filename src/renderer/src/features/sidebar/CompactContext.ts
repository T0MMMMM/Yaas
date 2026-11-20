import { createContext, useContext } from 'react'

/** Whether the sidebar is icon-only (dragged narrower than the compact threshold). */
export const CompactContext = createContext(false)

export const useCompact = (): boolean => useContext(CompactContext)
