import { createContext } from 'react'

/** The hues of the folders a row sits in, outermost first (empty outside any folder). */
export const FolderTrailContext = createContext<string[]>([])
